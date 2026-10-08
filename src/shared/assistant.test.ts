import { beforeEach, describe, expect, it } from 'vitest'
import { classifyReply, handleInbound, PENDING_TTL_MS } from './assistant.ts'
import { ruleInterpreter } from './parseSales.ts'
import type { AssistantStore, BusinessCtx, Pending, SalesDraft } from './types.ts'

const business: BusinessCtx = { id: 'b1', name: 'Demo', currency: 'GTQ', timezone: 'America/Guatemala' }
// 2026-10-08 15:00 en Guatemala (UTC-6) = 21:00 UTC
const NOW = new Date('2026-10-08T21:00:00Z')

class MemStore implements AssistantStore {
  pending: Pending | null = null
  sales: SalesDraft[] = []
  async getPending() { return this.pending }
  async setPending(p: Pending | null) { this.pending = p }
  async insertSale(d: SalesDraft) { this.sales.push(d) }
  async salesTotalOn(date: string) {
    return this.sales.filter((s) => s.date === date).reduce((n, s) => n + s.cashCents + s.cardCents + s.otherCents, 0)
  }
}

let store: MemStore
const say = (text: string, now = NOW) =>
  handleInbound({ business, text, store, interpreter: ruleInterpreter, now })

beforeEach(() => { store = new MemStore() })

describe('classifyReply', () => {
  it.each(['sí', 'Si', 'si!', 'correcto', 'Dale', 'ok', 'así es', 'está bien', '👍', '✅'])('"%s" es sí', (t) => {
    expect(classifyReply(t)).toBe('yes')
  })
  it.each(['no', 'No.', 'cancela', 'incorrecto'])('"%s" es no', (t) => {
    expect(classifyReply(t)).toBe('no')
  })
  it.each(['no, fueron 3,000 efectivo', 'sí pero fue ayer y vendimos 500', '', 'hola'])('"%s" es otra cosa', (t) => {
    expect(classifyReply(t)).toBe('other')
  })
})

describe('flujo: registrar ventas del día', () => {
  it('confirma lo entendido y NO guarda hasta recibir el sí', async () => {
    const [reply] = await say('Hoy vendimos 4,850: 3,200 efectivo y 1,650 tarjeta, propinas 300')
    expect(reply).toBe(
      'Anoté ventas de hoy: Q4,850\n• Efectivo Q3,200\n• Tarjeta Q1,650\nPropinas aparte: Q300\n¿Correcto? (sí / no)',
    )
    expect(store.sales).toHaveLength(0)
    expect(store.pending?.kind).toBe('sales')
  })

  it('guarda al confirmar y limpia el pendiente', async () => {
    await say('Hoy vendimos 4,850: 3,200 efectivo y 1,650 tarjeta, propinas 300')
    const [reply] = await say('sí')
    expect(store.sales).toEqual([
      { date: '2026-10-08', cashCents: 320000, cardCents: 165000, otherCents: 0, tipsCents: 30000 },
    ])
    expect(store.pending).toBeNull()
    expect(reply).toContain('Guardé ventas de hoy: Q4,850')
  })

  it('cancela con no y no guarda nada', async () => {
    await say('vendimos 1000 en efectivo')
    const [reply] = await say('no')
    expect(store.sales).toHaveLength(0)
    expect(store.pending).toBeNull()
    expect(reply).toContain('no guardé nada')
  })

  it('una corrección reemplaza el borrador y vuelve a pedir confirmación', async () => {
    await say('vendimos 1000 en efectivo')
    const [reply] = await say('no, fueron 1200 efectivo y 300 tarjeta')
    expect(reply).toContain('Q1,500')
    expect(reply).toContain('¿Correcto?')
    expect(store.sales).toHaveLength(0)
    await say('sí')
    expect(store.sales).toHaveLength(1)
    expect(store.sales[0]).toMatchObject({ cashCents: 120000, cardCents: 30000 })
  })

  it('si el desglose no cuadra, pregunta y no deja nada pendiente', async () => {
    const [reply] = await say('vendimos 4850: 3200 efectivo y 1700 tarjeta')
    expect(reply).toContain('Q4,850')
    expect(reply).toContain('Q4,900')
    expect(store.pending).toBeNull()
  })

  it('respeta "ayer" usando la fecha del negocio (no la del servidor)', async () => {
    // 02:00 UTC del 9 de octubre sigue siendo 8 de octubre en Guatemala
    const late = new Date('2026-10-09T02:00:00Z')
    await say('ayer vendimos 800 efectivo', late)
    await say('sí', late)
    expect(store.sales[0]?.date).toBe('2026-10-07')
  })

  it('avisa si ya había ventas ese día', async () => {
    await say('vendimos 1000 efectivo')
    await say('sí')
    const [reply] = await say('vendimos 500 tarjeta')
    expect(reply).toContain('ya había Q1,000')
  })

  it('un sí viejo no guarda nada: la confirmación vence', async () => {
    await say('vendimos 1000 efectivo')
    const later = new Date(NOW.getTime() + PENDING_TTL_MS + 60_000)
    const [reply] = await say('sí', later)
    expect(store.sales).toHaveLength(0)
    expect(reply).toContain('Por ahora anoto las ventas')
  })

  it('con algo pendiente, un mensaje sin sentido recuerda responder sí o no', async () => {
    await say('vendimos 1000 efectivo')
    const [reply] = await say('jaja ok pero espere')
    expect(reply).toContain('"sí"')
    expect(store.pending).not.toBeNull()
  })

  it('mensajes fuera de alcance reciben una respuesta honesta', async () => {
    expect((await say('¿cuánto le debo a la carnicería?'))[0]).toContain('todavía no lo sé hacer')
    expect((await say('hola'))[0]).toContain('Por ahora anoto las ventas')
  })
})
