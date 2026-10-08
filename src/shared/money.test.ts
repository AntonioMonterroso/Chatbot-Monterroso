import { describe, expect, it } from 'vitest'
import { findAmounts, formatMoney, parseMoneyToCents } from './money.ts'

describe('parseMoneyToCents', () => {
  it.each([
    ['4850', 485000],
    ['4,850', 485000],
    ['4,850.50', 485050],
    ['Q4,850', 485000],
    ['Q 1,200.5', 120050],
    ['$1,200', 120000],
    ['1,234,567', 123456700],
    ['1.650,50', 165050],
    ['0.5', 50],
    ['75,5', 7550],
    ['2 mil', 200000],
    ['2.5 mil', 250000],
    ['4 mil 850', 485000],
    ['100 quetzales', 10000],
  ])('%s -> %i centavos', (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents)
  })

  it.each(['', 'abc', '1.650', '1,2,3', '12.345.678,5x', '4,', '-5'])('rechaza o marca ambiguo: "%s"', (input) => {
    expect(parseMoneyToCents(input)).toBeNull()
  })

  it('no acumula error de float', () => {
    expect(parseMoneyToCents('0.1')! + parseMoneyToCents('0.2')!).toBe(30)
    expect(parseMoneyToCents('1,650.10')).toBe(165010)
  })
})

describe('findAmounts', () => {
  it('encuentra varios montos con su posición', () => {
    const found = findAmounts('3,200 efectivo y q1,650 tarjeta')
    expect(found.map((f) => f.cents)).toEqual([320000, 165000])
  })
  it('ignora el punto final de la oración', () => {
    expect(findAmounts('vendimos 500.').map((f) => f.cents)).toEqual([50000])
  })
})

describe('formatMoney', () => {
  it('formatea quetzales y dólares sin decimales innecesarios', () => {
    expect(formatMoney(485000, 'GTQ')).toBe('Q4,850')
    expect(formatMoney(485050, 'GTQ')).toBe('Q4,850.50')
    expect(formatMoney(120005, 'USD')).toBe('$1,200.05')
    expect(formatMoney(0, 'GTQ')).toBe('Q0')
    expect(formatMoney(123456789, 'GTQ')).toBe('Q1,234,567.89')
  })
})
