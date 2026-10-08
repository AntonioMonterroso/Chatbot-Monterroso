import { addDays, daysBetween, formatDateEs, isValidIsoDate } from './dates.ts'
import { formatMoney } from './money.ts'
import type { Currency, SalesDraft, SalesExtraction } from './types.ts'

/** Tope por día para atrapar errores de dedo (un cero de más). */
export const MAX_DAILY_CENTS = 1_000_000 * 100
/** No se registran ventas de hace más de esto sin que el dueño dé una fecha clara. */
export const MAX_DAYS_BACK = 45

export const saleTotal = (d: SalesDraft) => d.cashCents + d.cardCents + d.otherCents

export type DraftResult = { ok: true; draft: SalesDraft } | { ok: false; ask: string }

/**
 * Valida lo que extrajo el intérprete y arma el borrador. Es la última línea de defensa:
 * aunque el modelo se equivoque, nada raro llega a la confirmación sin pasar por aquí.
 */
export function buildDraft(x: SalesExtraction, today: string, currency: Currency): DraftResult {
  const money = (c: number) => formatMoney(c, currency)
  const parts = [x.cashCents, x.cardCents, x.otherCents, x.tipsCents, x.statedTotalCents]
  if (parts.some((p) => p !== null && (!Number.isSafeInteger(p) || p < 0))) {
    return { ok: false, ask: 'Uno de los montos no se entiende. ¿Me los escribe de nuevo?' }
  }

  const date = resolveDate(x, today)
  if (date === null) {
    return { ok: false, ask: '¿De qué día son esas ventas? Escríbame algo como "ayer" o "5 de octubre".' }
  }
  if (daysBetween(today, date) > 0) {
    return { ok: false, ask: `Esa fecha (${formatDateEs(date)}) todavía no llega. ¿De qué día son las ventas?` }
  }
  if (daysBetween(date, today) > MAX_DAYS_BACK) {
    return { ok: false, ask: `Esa fecha (${formatDateEs(date)}) es muy antigua. ¿Es correcta?` }
  }

  let cash = x.cashCents ?? 0
  let card = x.cardCents ?? 0
  let other = x.otherCents ?? 0
  const tips = x.tipsCents ?? 0
  const detailed = cash + card + other

  if (x.statedTotalCents !== null) {
    if (detailed === 0) {
      other = x.statedTotalCents // total sin desglose
    } else if (detailed !== x.statedTotalCents) {
      return {
        ok: false,
        ask:
          `Me dijo ${money(x.statedTotalCents)} en total, pero el desglose suma ${money(detailed)}. ` +
          '¿Cuál es el correcto?',
      }
    }
  }
  cash = Math.max(0, cash)
  card = Math.max(0, card)

  const draft: SalesDraft = { date, cashCents: cash, cardCents: card, otherCents: other, tipsCents: tips }
  const total = saleTotal(draft)
  if (total === 0) {
    return { ok: false, ask: '¿Cuánto fue lo que vendieron? Escríbame el monto, por ejemplo "vendimos 4,850".' }
  }
  if (total > MAX_DAILY_CENTS) {
    return { ok: false, ask: `${money(total)} en un día parece mucho. ¿Me lo escribe de nuevo para estar seguros?` }
  }
  return { ok: true, draft }
}

function resolveDate(x: SalesExtraction, today: string): string | null {
  switch (x.dateHint) {
    case 'today':
    case null:
      return today
    case 'yesterday':
      return addDays(today, -1)
    case 'two_days_ago':
      return addDays(today, -2)
    case 'explicit':
      return x.date !== null && isValidIsoDate(x.date) ? x.date : null
  }
}

/** Texto corto con lo entendido. `verb` es "Anoté" al pedir confirmación y "Guardé" al terminar. */
export function summarizeDraft(
  d: SalesDraft,
  currency: Currency,
  today: string,
  verb: 'Anoté' | 'Guardé' = 'Anoté',
): string {
  const money = (c: number) => formatMoney(c, currency)
  const when = d.date === today ? 'de hoy' : `del ${formatDateEs(d.date)}`
  const lines = [`${verb} ventas ${when}: ${money(saleTotal(d))}`]
  // Sin efectivo ni tarjeta, el total viene sin desglose y no hay nada que detallar
  if (d.cashCents || d.cardCents) {
    if (d.cashCents) lines.push(`• Efectivo ${money(d.cashCents)}`)
    if (d.cardCents) lines.push(`• Tarjeta ${money(d.cardCents)}`)
    if (d.otherCents) lines.push(`• Otros ${money(d.otherCents)}`)
  }
  if (d.tipsCents) lines.push(`Propinas aparte: ${money(d.tipsCents)}`)
  return lines.join('\n')
}
