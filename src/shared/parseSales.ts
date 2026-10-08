import { findAmounts, type FoundAmount } from './money.ts'
import { MONTHS } from './dates.ts'
import type { InterpretInput, Interpretation, Interpreter, SalesExtraction } from './types.ts'

type Label = 'cash' | 'card' | 'other' | 'tips' | 'total'

const LABEL_WORDS: Record<Label, string> = {
  cash: 'efectivo|cash|contado',
  card: 'tarjetas?|pos|visanet|credomatic|debito|credito',
  other: 'transferencias?|depositos?|otros?',
  tips: 'propinas?',
  total: 'total',
}
const CONNECTOR = '(?:(?:en|de|por|con|a)\\s+)?(?:de\\s+)?'

const SALES_WORDS = /\b(vend\w*|venta\w*|ingres\w*|caja|factur\w*|propina\w*|efectivo|tarjeta\w*)\b/
const NOT_MONEY_AFTER = /^\s*(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|personas?|clientes?|mesas?|platos?|ordenes|comensales|cuentas|pedidos|tickets?|%|\/)/
const TOTAL_HINT = /(vend\w*|venta\w*|total|hicimos|caja|ingres\w*)\W*(?:de|fue|fueron|son|es)?\W*$/

/** Minúsculas y sin acentos, para comparar palabras sin pelear con tildes. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function labelFor(norm: string, amounts: FoundAmount[], i: number): Label | null {
  const a = amounts[i]!
  const prevEnd = i > 0 ? amounts[i - 1]!.end : 0
  const nextStart = i + 1 < amounts.length ? amounts[i + 1]!.start : norm.length
  const before = norm.slice(Math.max(prevEnd, a.start - 30), a.start)
  const after = norm.slice(a.end, Math.min(nextStart, a.end + 30))

  // Primero la etiqueta pegada antes del monto ("efectivo 3200"), luego la de después ("3200 efectivo")
  for (const label of Object.keys(LABEL_WORDS) as Label[]) {
    if (new RegExp(`(?:${LABEL_WORDS[label]})\\s*(?:de|:|=|fueron|son|es)?\\s*$`).test(before)) return label
  }
  for (const label of Object.keys(LABEL_WORDS) as Label[]) {
    if (new RegExp(`^\\s*${CONNECTOR}(?:${LABEL_WORDS[label]})\\b`).test(after)) return label
  }
  return null
}

function explicitDate(norm: string, today: string): string | null {
  const m = norm.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MONTHS.map(normalize).join('|')})\\b`))
  if (!m) return null
  const month = MONTHS.map(normalize).indexOf(m[2]!) + 1
  const day = Number(m[1])
  let year = Number(today.slice(0, 4))
  const iso = (y: number) => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (iso(year) > today) year -= 1 // "28 de diciembre" dicho en enero es del año pasado
  return iso(year)
}

/** Interpreta un mensaje de ventas con reglas. Sirve de respaldo, para el modo demo y para pruebas. */
export function parseSalesText(text: string, today: string): Interpretation {
  const norm = normalize(text)
  const amounts = findAmounts(norm).filter((a) => !NOT_MONEY_AFTER.test(norm.slice(a.end, a.end + 25)))
  if (amounts.length === 0 || !SALES_WORDS.test(norm)) return { intent: 'other', sales: null }

  const sums: Record<Label, number | null> = { cash: null, card: null, other: null, tips: null, total: null }
  const unlabeled: { amount: FoundAmount; hinted: boolean }[] = []
  amounts.forEach((a, i) => {
    const label = labelFor(norm, amounts, i)
    if (label) {
      sums[label] = (sums[label] ?? 0) + a.cents
    } else {
      unlabeled.push({ amount: a, hinted: TOTAL_HINT.test(norm.slice(Math.max(0, a.start - 30), a.start)) })
    }
  })

  if (sums.total === null) {
    const hinted = unlabeled.filter((u) => u.hinted)
    const pick = hinted[0] ?? (unlabeled.length === 1 ? unlabeled[0] : undefined)
    if (pick) sums.total = pick.amount.cents
  }

  const hasMoney = [sums.cash, sums.card, sums.other, sums.total].some((v) => v !== null)
  if (!hasMoney) return { intent: 'other', sales: null }

  const explicit = explicitDate(norm, today)
  const sales: SalesExtraction = {
    dateHint: explicit
      ? 'explicit'
      : /\banteayer\b/.test(norm)
        ? 'two_days_ago'
        : /\bayer\b/.test(norm)
          ? 'yesterday'
          : 'today',
    date: explicit,
    statedTotalCents: sums.total,
    cashCents: sums.cash,
    cardCents: sums.card,
    otherCents: sums.other,
    tipsCents: sums.tips,
  }
  return { intent: 'register_sales', sales }
}

/** Intérprete por reglas: no necesita red ni claves. */
export const ruleInterpreter: Interpreter = {
  async interpret({ text, today }: InterpretInput) {
    return parseSalesText(text, today)
  },
}
