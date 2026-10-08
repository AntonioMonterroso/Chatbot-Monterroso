import type { Currency } from './types.ts'

const SYMBOL: Record<Currency, string> = { GTQ: 'Q', USD: '$' }

/**
 * Convierte un monto escrito por una persona a centavos enteros.
 * Acepta "4850", "4,850", "4,850.50", "Q4,850", "$ 1,200", "1.650,50", "2.5 mil", "4 mil 850".
 * Devuelve null si es ambiguo o no es un monto (p. ej. "1.650": ¿1.65 o 1,650?).
 * Nunca usa float para guardar dinero: el resultado es entero.
 */
export function parseMoneyToCents(input: string): number | null {
  let s = input.toLowerCase().trim()
  s = s.replace(/^(gtq|usd|q|\$)\s*/, '').replace(/\s*(gtq|usd|quetzales?|dolares?)$/, '')

  // "4 mil 850", "2 mil", "2.5 mil"
  const mil = s.match(/^(\d+(?:[.,]\d+)?)\s*mil(?:\s+(\d{1,3}))?$/)
  if (mil) {
    const base = parseMoneyToCents(mil[1]!)
    if (base === null) return null
    const rest = mil[2] ? Number(mil[2]) * 100 : 0
    return base * 1000 + rest
  }

  if (!/^\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return null

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let intPart: string
  let decPart = ''

  if (lastDot !== -1 && lastComma !== -1) {
    // Gana como decimal el separador que aparece al final ("1,650.50" o "1.650,50")
    const decSep = lastDot > lastComma ? '.' : ','
    const thouSep = decSep === '.' ? ',' : '.'
    const idx = s.lastIndexOf(decSep)
    intPart = s.slice(0, idx).split(thouSep).join('')
    decPart = s.slice(idx + 1)
    if (intPart.includes(decSep)) return null
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ','
    const parts = s.split(sep)
    const last = parts[parts.length - 1]!
    if (parts.length > 2) {
      // "1,234,567": solo vale si todos los grupos son de 3 dígitos
      if (!parts.slice(1).every((p) => p.length === 3)) return null
      intPart = parts.join('')
    } else if (last.length === 3) {
      // "4,850" es miles; "1.650" es ambiguo (en Guatemala el punto es decimal)
      if (sep === '.') return null
      intPart = parts.join('')
    } else if (last.length <= 2) {
      intPart = parts[0]!
      decPart = last
    } else {
      return null
    }
  } else {
    intPart = s
  }

  if (!/^\d+$/.test(intPart) || (decPart !== '' && !/^\d{1,2}$/.test(decPart))) return null
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0') || '0')
  return Number.isSafeInteger(cents) ? cents : null
}

export interface FoundAmount {
  cents: number
  start: number
  end: number
}

const AMOUNT_RE = /(?:(?:gtq|usd|q|\$)\s*)?\d[\d.,]*(?:\s*mil(?:\s+\d{1,3}\b)?)?/g

/** Busca montos dentro de un texto ya normalizado (minúsculas, sin acentos). */
export function findAmounts(text: string): FoundAmount[] {
  const out: FoundAmount[] = []
  for (const m of text.matchAll(AMOUNT_RE)) {
    // El regex puede arrastrar un "." o "," final de la oración ("vendimos 500.")
    const raw = m[0].replace(/[.,]+$/, '')
    const cents = parseMoneyToCents(raw)
    if (cents === null) continue
    out.push({ cents, start: m.index, end: m.index + raw.length })
  }
  return out
}

/** "Q4,850" o "Q4,850.50" (sin decimales si no hacen falta). */
export function formatMoney(cents: number, currency: Currency): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${SYMBOL[currency]}${grouped}${frac ? `.${String(frac).padStart(2, '0')}` : ''}`
}
