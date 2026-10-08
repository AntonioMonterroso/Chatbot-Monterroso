import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssistantStore, Pending, SalesDraft } from '../../../src/shared/types.ts'

/**
 * Store sobre Supabase. Usa el cliente con el JWT de la persona: la RLS decide qué puede ver y escribir,
 * así que un bug aquí no puede cruzar datos entre negocios.
 */
interface Ids {
  businessId: string
  conversationId: string
  userId: string
  source: 'simulator' | 'whatsapp'
}

export class SupabaseStore implements AssistantStore {
  private db: SupabaseClient
  private ids: Ids

  constructor(db: SupabaseClient, ids: Ids) {
    this.db = db
    this.ids = ids
  }

  async getPending(): Promise<Pending | null> {
    const { data, error } = await this.db
      .from('conversations')
      .select('pending')
      .eq('id', this.ids.conversationId)
      .single()
    if (error) throw error
    return (data.pending as Pending | null) ?? null
  }

  async setPending(p: Pending | null): Promise<void> {
    const { error } = await this.db.from('conversations').update({ pending: p }).eq('id', this.ids.conversationId)
    if (error) throw error
  }

  async insertSale(d: SalesDraft): Promise<void> {
    const { error } = await this.db.from('sales').insert({
      business_id: this.ids.businessId,
      sale_date: d.date,
      cash_cents: d.cashCents,
      card_cents: d.cardCents,
      other_cents: d.otherCents,
      tips_cents: d.tipsCents,
      source: this.ids.source,
      created_by: this.ids.userId,
    })
    if (error) throw error
  }

  async salesTotalOn(date: string): Promise<number> {
    const { data, error } = await this.db
      .from('sales')
      .select('total_cents')
      .eq('business_id', this.ids.businessId)
      .eq('sale_date', date)
    if (error) throw error
    return data.reduce((n, r) => n + Number(r.total_cents), 0)
  }
}
