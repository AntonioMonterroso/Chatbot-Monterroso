import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessCtx, Currency } from '../shared/types.ts'
import type { ChatBackend, SaleRow } from './backend.ts'

/** Backend real: Edge Function `assistant` + tablas con RLS. Requiere sesión iniciada. */
export async function createRemoteBackend(db: SupabaseClient): Promise<ChatBackend> {
  const { data, error } = await db
    .from('businesses')
    .select('id, name, currency, timezone')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Esta cuenta todavía no tiene un negocio. Corre `npm run seed:demo` o crea uno.')
  const business: BusinessCtx = { ...data, currency: data.currency as Currency }

  return {
    mode: 'supabase',
    business,
    async send(text) {
      const { data: res, error: err } = await db.functions.invoke<{ replies: string[] }>('assistant', {
        body: { text },
      })
      if (err) throw err
      return res?.replies ?? []
    },
    async listSales() {
      const { data: rows, error: err } = await db
        .from('sales')
        .select('id, sale_date, cash_cents, card_cents, other_cents, tips_cents, total_cents')
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(60)
      if (err) throw err
      return rows.map(
        (r): SaleRow => ({
          id: r.id,
          date: r.sale_date,
          cashCents: Number(r.cash_cents),
          cardCents: Number(r.card_cents),
          otherCents: Number(r.other_cents),
          tipsCents: Number(r.tips_cents),
          totalCents: Number(r.total_cents),
        }),
      )
    },
  }
}
