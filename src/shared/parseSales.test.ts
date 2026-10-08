import { describe, expect, it } from 'vitest'
import { parseSalesText } from './parseSales.ts'

const TODAY = '2026-10-08'
const parse = (t: string) => parseSalesText(t, TODAY)

describe('parseSalesText', () => {
  it('el ejemplo principal: total con efectivo y tarjeta', () => {
    const r = parse('Hoy vendimos 4,850: 3,200 efectivo y 1,650 tarjeta')
    expect(r.intent).toBe('register_sales')
    expect(r.sales).toMatchObject({
      dateHint: 'today',
      statedTotalCents: 485000,
      cashCents: 320000,
      cardCents: 165000,
      otherCents: null,
      tipsCents: null,
    })
  })

  it('etiqueta antes del monto', () => {
    const r = parse('ventas de hoy: efectivo 3200, tarjeta 1650')
    expect(r.sales).toMatchObject({ cashCents: 320000, cardCents: 165000, statedTotalCents: null })
  })

  it('etiqueta antes del monto sin comas', () => {
    const r = parse('efectivo 3200 tarjeta 1650')
    expect(r.sales).toMatchObject({ cashCents: 320000, cardCents: 165000 })
  })

  it('propinas aparte, en cualquier posición', () => {
    expect(parse('vendimos 4850, 3200 efectivo y 1650 tarjeta, 300 de propina').sales?.tipsCents).toBe(30000)
    expect(parse('vendimos 4850 y propinas 300 en tarjeta').sales).toMatchObject({
      statedTotalCents: 485000,
      tipsCents: 30000,
      cardCents: null,
    })
  })

  it('solo un total, sin desglose', () => {
    const r = parse('hoy vendí Q2,300')
    expect(r.sales).toMatchObject({ statedTotalCents: 230000, cashCents: null, cardCents: null })
  })

  it('fechas: ayer, anteayer y explícita', () => {
    expect(parse('ayer vendimos 1000').sales?.dateHint).toBe('yesterday')
    expect(parse('anteayer vendimos 1000').sales?.dateHint).toBe('two_days_ago')
    expect(parse('el 5 de octubre vendimos 1000').sales).toMatchObject({ dateHint: 'explicit', date: '2026-10-05' })
    expect(parse('el 28 de diciembre vendimos 1000').sales?.date).toBe('2025-12-28')
  })

  it('no confunde el día del mes ni el número de clientes con un monto', () => {
    const r = parse('el 8 de octubre vendimos 1500, atendimos 40 clientes')
    expect(r.sales?.statedTotalCents).toBe(150000)
    expect(r.sales?.date).toBe('2026-10-08')
  })

  it('suma si repiten una etiqueta', () => {
    expect(parse('100 efectivo y 50 efectivo').sales?.cashCents).toBe(15000)
  })

  it('acepta símbolos de moneda y "mil"', () => {
    const r = parse('vendimos 4 mil 850: Q3,200 efectivo y $1650 tarjeta')
    expect(r.sales).toMatchObject({ statedTotalCents: 485000, cashCents: 320000, cardCents: 165000 })
  })

  it.each(['hola', 'buenos días', 'compré pollo por 300', '¿cuánto vendí esta semana?', 'vendimos mucho hoy'])(
    'no es registro de ventas: "%s"',
    (t) => {
      expect(parse(t).intent).toBe('other')
    },
  )
})
