// Crea un usuario y un restaurante inventado ("Comedor Doña Mari") para demos contra Supabase real o local.
// Uso:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:demo
// Opcional: DEMO_EMAIL, DEMO_PASSWORD (si no se da, se genera una y se imprime una sola vez).
// Usa la service role: correr SOLO en tu máquina, nunca desde el navegador ni en CI.
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } })
const email = process.env.DEMO_EMAIL ?? 'demo@monterroso.chat.test'
const password = process.env.DEMO_PASSWORD ?? randomBytes(12).toString('base64url')

const { data: created, error: userErr } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: 'Doña Mari (demo)' },
})
if (userErr) {
  console.error('No se pudo crear el usuario (¿ya existe?):', userErr.message)
  process.exit(1)
}
const userId = created.user.id

const { data: biz, error: bizErr } = await db
  .from('businesses')
  .insert({ name: 'Comedor Doña Mari (demo)', country_code: 'GT', currency: 'GTQ', timezone: 'America/Guatemala' })
  .select('id')
  .single()
if (bizErr) throw bizErr
await db.from('business_members').insert({ business_id: biz.id, user_id: userId, role: 'owner' }).throwOnError()

const today = new Date()
const day = (back: number) => {
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}
const q = (n: number) => n * 100 // quetzales -> centavos

const sales = [
  [6, 2900, 1400, 180], [5, 3350, 1900, 260], [4, 2100, 1250, 90],
  [3, 3800, 2450, 340], [2, 4100, 2750, 410], [1, 3200, 1800, 220],
] as const
await db
  .from('sales')
  .insert(
    sales.map(([back, cash, card, tips]) => ({
      business_id: biz.id,
      sale_date: day(back),
      cash_cents: q(cash),
      card_cents: q(card),
      tips_cents: q(tips),
      source: 'panel',
      created_by: userId,
    })),
  )
  .throwOnError()

const { data: suppliers } = await db
  .from('suppliers')
  .insert([
    { business_id: biz.id, name: 'Carnicería El Buen Corte' },
    { business_id: biz.id, name: 'Verduras Don Chepe' },
  ])
  .select('id, name')
  .throwOnError()
const butcher = suppliers!.find((s) => s.name.startsWith('Carnicería'))!
await db
  .from('expenses')
  .insert([
    { business_id: biz.id, supplier_id: butcher.id, expense_date: day(3), amount_cents: q(1850), on_credit: true, invoice_number: 'A-1042' },
    { business_id: biz.id, supplier_id: butcher.id, expense_date: day(1), amount_cents: q(920), on_credit: true, invoice_number: 'A-1067' },
  ])
  .throwOnError()

console.log('Listo. Restaurante de demo creado.')
console.log(`  correo:      ${email}`)
console.log(`  contraseña:  ${process.env.DEMO_PASSWORD ? '(la que diste)' : password}`)
