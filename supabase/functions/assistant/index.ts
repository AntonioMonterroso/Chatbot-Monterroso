import { createClient } from '@supabase/supabase-js'
import { handleInbound } from '../../../src/shared/assistant.ts'
import { MSG } from '../../../src/shared/messages.ts'
import type { BusinessCtx, Currency } from '../../../src/shared/types.ts'
import { ClaudeInterpreter, DEFAULT_MODEL, RefusalError } from './claude.ts'
import { SupabaseStore } from './store.ts'

const MAX_TEXT = 2000

const cors = {
  'Access-Control-Allow-Origin': '*', // el JWT es el control de acceso, no el origen
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/**
 * POST { text } -> { replies: string[] }
 * Requiere sesión (verify_jwt). Lee y escribe con el JWT de la persona, así que la RLS aplica.
 * No se loguea el contenido de los mensajes: es información financiera.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'unauthorized' }, 401)
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'server_not_configured' }, 500)

  let text: string
  try {
    const body = await req.json()
    text = typeof body?.text === 'string' ? body.text.trim() : ''
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!text || text.length > MAX_TEXT) return json({ error: 'bad_request' }, 400)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await db.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  // Un negocio por persona por ahora; cuando haya varios se elegirá cuál en el cuerpo.
  const { data: biz, error: bizErr } = await db
    .from('businesses')
    .select('id, name, currency, timezone')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (bizErr) return json({ error: 'server_error' }, 500)
  if (!biz) return json({ error: 'no_business' }, 404)
  const business: BusinessCtx = {
    id: biz.id,
    name: biz.name,
    currency: biz.currency as Currency,
    timezone: biz.timezone,
  }

  const { data: conv, error: convErr } = await db
    .from('conversations')
    .upsert(
      { business_id: business.id, user_id: userId, channel: 'simulator' },
      { onConflict: 'business_id,user_id,channel' },
    )
    .select('id')
    .single()
  if (convErr) return json({ error: 'server_error' }, 500)

  const log = (direction: 'in' | 'out', body: string) =>
    db.from('messages').insert({ conversation_id: conv.id, business_id: business.id, direction, body })

  await log('in', text)

  let replies: string[]
  try {
    replies = await handleInbound({
      business,
      text,
      store: new SupabaseStore(db, { businessId: business.id, conversationId: conv.id, userId, source: 'simulator' }),
      interpreter: new ClaudeInterpreter(apiKey, Deno.env.get('ANTHROPIC_MODEL') || DEFAULT_MODEL),
    })
  } catch (e) {
    // Sin datos del mensaje en el log: solo el tipo de error.
    console.error('assistant_failed', e instanceof Error ? e.name : 'unknown')
    replies = [e instanceof RefusalError ? MSG.refused : MSG.trouble]
  }

  for (const r of replies) await log('out', r)
  return json({ replies })
})
