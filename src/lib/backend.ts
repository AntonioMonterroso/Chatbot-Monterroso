import type { BusinessCtx } from '../shared/types.ts'

export interface SaleRow {
  id: string
  date: string
  cashCents: number
  cardCents: number
  otherCents: number
  tipsCents: number
  totalCents: number
}

/** Lo que el simulador necesita de un "servidor": demo local o Supabase. */
export interface ChatBackend {
  mode: 'demo' | 'supabase'
  business: BusinessCtx
  send(text: string): Promise<string[]>
  listSales(): Promise<SaleRow[]>
  /** Solo el modo demo: borra lo guardado y vuelve a los datos de ejemplo. */
  reset?(): void
}
