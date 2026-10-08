import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create }
  },
}))

import { ClaudeInterpreter, DEFAULT_MODEL, RefusalError } from './claude.ts'

const input = { text: 'Hoy vendimos 4,850', today: '2026-10-08', currency: 'GTQ' as const }
const reply = (o: object, stop_reason = 'end_turn') => ({
  stop_reason,
  content: [{ type: 'text', text: JSON.stringify(o) }],
})
const base = { intent: 'register_sales', date_hint: 'today', date: null, stated_total: null, cash: null, card: null, other: null, tips: null }

beforeEach(() => create.mockReset())

describe('ClaudeInterpreter', () => {
  it('convierte unidades a centavos enteros sin error de float', async () => {
    create.mockResolvedValue(reply({ ...base, stated_total: 4850.1, cash: 3200.05, card: 1650.05, tips: 300 }))
    const r = await new ClaudeInterpreter('k').interpret(input)
    expect(r.sales).toMatchObject({ statedTotalCents: 485010, cashCents: 320005, cardCents: 165005, tipsCents: 30000 })
  })

  it('usa el modelo por defecto, salida estructurada y nada de tool_choice forzado ni thinking desactivado', async () => {
    create.mockResolvedValue(reply(base))
    await new ClaudeInterpreter('k').interpret({ ...input, pendingSummary: 'Anoté ventas de hoy: Q100' })
    const req = create.mock.calls[0]![0]
    expect(req.model).toBe(DEFAULT_MODEL)
    expect(req.output_config.format.type).toBe('json_schema')
    expect(req).not.toHaveProperty('tool_choice')
    expect(req).not.toHaveProperty('thinking')
    expect(req).not.toHaveProperty('temperature')
    expect(req.messages[0].content).toContain('Confirmación pendiente')
  })

  it('"other" no trae ventas', async () => {
    create.mockResolvedValue(reply({ ...base, intent: 'other' }))
    expect(await new ClaudeInterpreter('k').interpret(input)).toEqual({ intent: 'other', sales: null })
  })

  it('descarta una fecha explícita inválida en vez de guardarla', async () => {
    create.mockResolvedValue(reply({ ...base, date_hint: 'explicit', date: '2026-02-30', cash: 100 }))
    const r = await new ClaudeInterpreter('k').interpret(input)
    expect(r.sales?.date).toBeNull()
  })

  it('una negativa del modelo se reporta como RefusalError', async () => {
    create.mockResolvedValue({ stop_reason: 'refusal', content: [] })
    await expect(new ClaudeInterpreter('k').interpret(input)).rejects.toBeInstanceOf(RefusalError)
  })

  it('una respuesta truncada falla en vez de adivinar', async () => {
    create.mockResolvedValue({ stop_reason: 'max_tokens', content: [] })
    await expect(new ClaudeInterpreter('k').interpret(input)).rejects.toThrow('max_tokens')
  })
})
