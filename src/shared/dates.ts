const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria del negocio, no la del servidor. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  return toUtc(iso).toISOString().slice(0, 10) === iso
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso).getTime() - toUtc(fromIso).getTime()) / 86_400_000)
}

/** "jueves 8 de octubre" */
export function formatDateEs(iso: string): string {
  const d = toUtc(iso)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`
}
