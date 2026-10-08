import { todayIn } from './dates.ts'
import { formatMoney } from './money.ts'
import { MSG } from './messages.ts'
import { normalize } from './parseSales.ts'
import { buildDraft, summarizeDraft } from './sales.ts'
import type { AssistantStore, BusinessCtx, Interpreter, Pending } from './types.ts'

/** Una confirmación sin respuesta vence: un "sí" de mañana no debe guardar las ventas de hoy. */
export const PENDING_TTL_MS = 6 * 60 * 60 * 1000

const YES_WORDS = new Set([
  'si', 'sii', 'siii', 'correcto', 'correcta', 'ok', 'okey', 'dale', 'listo', 'exacto',
  'confirmo', 'confirmado', 'claro', 'perfecto', 'guardalo',
])
const YES_PHRASES = new Set(['asi es', 'esta bien', 'de acuerdo', 'si esta bien', 'si asi es'])
const NO_WORDS = new Set(['no', 'nel', 'negativo', 'cancela', 'cancelar', 'cancelalo', 'incorrecto', 'mal', 'nada'])

const tokens = (text: string) =>
  normalize(text)
    .replace(/[^a-z0-9\s]/g, ' ') // quita signos y emojis
    .split(/\s+/)
    .filter(Boolean)

/** "sí" / "no" solo si el mensaje entero es una respuesta corta; si trae más, es una corrección. */
export function classifyReply(text: string): 'yes' | 'no' | 'other' {
  if (/^\s*(?:👍|✅|👌)\s*$/u.test(text)) return 'yes'
  const t = tokens(text)
  if (t.length === 0 || t.length > 4) return 'other'
  if (t.every((w) => NO_WORDS.has(w))) return 'no'
  if (t.every((w) => YES_WORDS.has(w)) || YES_PHRASES.has(t.join(' '))) return 'yes'
  return 'other'
}

export interface HandleInput {
  business: BusinessCtx
  text: string
  store: AssistantStore
  interpreter: Interpreter
  now?: Date
}

/** Procesa un mensaje del dueño y devuelve las respuestas a enviar. No guarda nada sin un "sí". */
export async function handleInbound(input: HandleInput): Promise<string[]> {
  const { business, text, store, interpreter } = input
  const now = input.now ?? new Date()
  const today = todayIn(business.timezone, now)
  const money = (c: number) => formatMoney(c, business.currency)

  let pending = await store.getPending()
  if (pending && now.getTime() - Date.parse(pending.createdAt) > PENDING_TTL_MS) {
    await store.setPending(null)
    pending = null
  }

  if (pending) {
    const reply = classifyReply(text)
    if (reply === 'yes') {
      await store.insertSale(pending.draft)
      await store.setPending(null)
      return [MSG.saved(summarizeDraft(pending.draft, business.currency, today, 'Guardé'))]
    }
    if (reply === 'no') {
      await store.setPending(null)
      return [MSG.cancelled]
    }
  }

  const pendingSummary = pending
    ? summarizeDraft(pending.draft, business.currency, today)
    : undefined
  const result = await interpreter.interpret({ text, today, currency: business.currency, pendingSummary })

  if (result.intent !== 'register_sales' || !result.sales) {
    return [pending ? MSG.needYesNo : looksLikeOtherTask(text) ? MSG.notYet : MSG.help]
  }

  const built = buildDraft(result.sales, today, business.currency)
  if (!built.ok) return [built.ask]

  const next: Pending = { kind: 'sales', draft: built.draft, createdAt: now.toISOString() }
  await store.setPending(next)

  const lines = [summarizeDraft(built.draft, business.currency, today)]
  const already = await store.salesTotalOn(built.draft.date)
  if (already > 0) lines.push(MSG.duplicateWarning(money(already)))
  lines.push(MSG.confirmSuffix)
  return [lines.join('\n')]
}

const OTHER_TASKS = /\b(gast\w*|compr\w*|factura\w*|debo|deuda|proveedor\w*|cuanto|resumen)\b/

function looksLikeOtherTask(text: string): boolean {
  return OTHER_TASKS.test(normalize(text))
}
