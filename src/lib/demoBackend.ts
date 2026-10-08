import { handleInbound } from '../shared/assistant.ts'
import { addDays, todayIn } from '../shared/dates.ts'
import { ruleInterpreter } from '../shared/parseSales.ts'
import type { AssistantStore, BusinessCtx, Pending, SalesDraft } from '../shared/types.ts'
import type { ChatBackend, SaleRow } from './backend.ts'

/** Restaurante inventado para demos. Ningún dato aquí es real. */
export const DEMO_BUSINESS: BusinessCtx = {
  id: 'demo-business',
  name: 'Comedor Doña Mari (demo)',
  currency: 'GTQ',
  timezone: 'America/Guatemala',
}

const KEY = 'monterroso-chat-demo-v1'

interface DemoState {
  pending: Pending | null
  sales: SaleRow[]
}

/** Ventas de ejemplo de los últimos días, en cifras redondas inventadas. */
function seedSales(): SaleRow[] {
  const today = todayIn(DEMO_BUSINESS.timezone)
  const days: [number, number, number, number][] = [
    // [días atrás, efectivo, tarjeta, propinas] en quetzales
    [6, 2900, 1400, 180],
    [5, 3350, 1900, 260],
    [4, 2100, 1250, 90],
    [3, 3800, 2450, 340],
    [2, 4100, 2750, 410],
    [1, 3200, 1800, 220],
  ]
  return days.map(([back, cash, card, tips], i) => ({
    id: `seed-${i}`,
    date: addDays(today, -back),
    cashCents: cash * 100,
    cardCents: card * 100,
    otherCents: 0,
    tipsCents: tips * 100,
    totalCents: (cash + card) * 100,
  }))
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    // El chat visible no se guarda, así que una confirmación pendiente tampoco debe sobrevivir al recargar
    if (raw) return { ...(JSON.parse(raw) as DemoState), pending: null }
  } catch {
    // localStorage no disponible o dañado: se arranca de cero
  }
  return { pending: null, sales: seedSales() }
}

function save(s: DemoState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // modo privado: la demo sigue funcionando en memoria
  }
}

export function createDemoBackend(): ChatBackend {
  let state = load()

  const store: AssistantStore = {
    async getPending() {
      return state.pending
    },
    async setPending(p) {
      state.pending = p
      save(state)
    },
    async insertSale(d: SalesDraft) {
      state.sales.push({
        id: crypto.randomUUID(),
        date: d.date,
        cashCents: d.cashCents,
        cardCents: d.cardCents,
        otherCents: d.otherCents,
        tipsCents: d.tipsCents,
        totalCents: d.cashCents + d.cardCents + d.otherCents,
      })
      save(state)
    },
    async salesTotalOn(date) {
      return state.sales.filter((s) => s.date === date).reduce((n, s) => n + s.totalCents, 0)
    },
  }

  return {
    mode: 'demo',
    business: DEMO_BUSINESS,
    send: (text) => handleInbound({ business: DEMO_BUSINESS, text, store, interpreter: ruleInterpreter }),
    listSales: async () => [...state.sales].sort((a, b) => b.date.localeCompare(a.date)),
    reset() {
      state = { pending: null, sales: seedSales() }
      save(state)
    },
  }
}
