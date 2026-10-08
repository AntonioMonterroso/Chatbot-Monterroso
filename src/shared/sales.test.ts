import { describe, expect, it } from 'vitest'
import { buildDraft, summarizeDraft } from './sales.ts'
import type { SalesExtraction } from './types.ts'

const TODAY = '2026-10-08'
const x = (o: Partial<SalesExtraction>): SalesExtraction => ({
  dateHint: 'today', date: null, statedTotalCents: null,
  cashCents: null, cardCents: null, otherCents: null, tipsCents: null, ...o,
})

describe('buildDraft', () => {
  it('acepta un desglose que cuadra con el total', () => {
    const r = buildDraft(x({ statedTotalCents: 485000, cashCents: 320000, cardCents: 165000 }), TODAY, 'GTQ')
    expect(r).toEqual({
      ok: true,
      draft: { date: TODAY, cashCents: 320000, cardCents: 165000, otherCents: 0, tipsCents: 0 },
    })
  })

  it('pide aclarar si el desglose no suma el total', () => {
    const r = buildDraft(x({ statedTotalCents: 485000, cashCents: 320000, cardCents: 170000 }), TODAY, 'GTQ')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.ask).toContain('Q4,850')
  })

  it('un total sin desglose queda en "otros"', () => {
    const r = buildDraft(x({ statedTotalCents: 230000 }), TODAY, 'GTQ')
    expect(r.ok && r.draft.otherCents).toBe(230000)
  })

  it('las propinas no suman a la venta', () => {
    const r = buildDraft(x({ cashCents: 100000, tipsCents: 30000 }), TODAY, 'GTQ')
    expect(r.ok && r.draft.tipsCents).toBe(30000)
  })

  it('rechaza ventas en cero, negativas y absurdas', () => {
    expect(buildDraft(x({}), TODAY, 'GTQ').ok).toBe(false)
    expect(buildDraft(x({ cashCents: -100 }), TODAY, 'GTQ').ok).toBe(false)
    expect(buildDraft(x({ cashCents: 1.5 }), TODAY, 'GTQ').ok).toBe(false)
    expect(buildDraft(x({ cashCents: 2_000_000 * 100 }), TODAY, 'GTQ').ok).toBe(false)
  })

  it('valida fechas: ayer sí, futura y muy antigua no', () => {
    const base = { cashCents: 1000 }
    const y = buildDraft(x({ ...base, dateHint: 'yesterday' }), TODAY, 'GTQ')
    expect(y.ok && y.draft.date).toBe('2026-10-07')
    expect(buildDraft(x({ ...base, dateHint: 'explicit', date: '2026-10-09' }), TODAY, 'GTQ').ok).toBe(false)
    expect(buildDraft(x({ ...base, dateHint: 'explicit', date: '2026-01-01' }), TODAY, 'GTQ').ok).toBe(false)
    expect(buildDraft(x({ ...base, dateHint: 'explicit', date: '2026-02-30' }), TODAY, 'GTQ').ok).toBe(false)
    expect(buildDraft(x({ ...base, dateHint: 'explicit', date: null }), TODAY, 'GTQ').ok).toBe(false)
  })
})

describe('summarizeDraft', () => {
  it('muestra desglose y propinas', () => {
    const text = summarizeDraft(
      { date: TODAY, cashCents: 320000, cardCents: 165000, otherCents: 0, tipsCents: 30000 },
      'GTQ',
      TODAY,
    )
    expect(text).toBe(
      'Anoté ventas de hoy: Q4,850\n• Efectivo Q3,200\n• Tarjeta Q1,650\nPropinas aparte: Q300',
    )
  })
  it('usa la fecha en palabras si no es hoy y omite el desglose si no hay', () => {
    const text = summarizeDraft(
      { date: '2026-10-07', cashCents: 0, cardCents: 0, otherCents: 230000, tipsCents: 0 },
      'USD',
      TODAY,
      'Guardé',
    )
    expect(text).toBe('Guardé ventas del miércoles 7 de octubre: $2,300')
  })
})
