export type Currency = 'GTQ' | 'USD'

/** Datos del negocio que el asistente necesita. Todo se guarda por negocio, no global. */
export interface BusinessCtx {
  id: string
  name: string
  currency: Currency
  /** Zona horaria IANA, p. ej. America/Guatemala */
  timezone: string
}

/** Lo que el intérprete (reglas o Claude) extrae de un mensaje. Montos en centavos enteros. */
export interface SalesExtraction {
  dateHint: 'today' | 'yesterday' | 'two_days_ago' | 'explicit' | null
  /** AAAA-MM-DD cuando dateHint es 'explicit' */
  date: string | null
  /** Total que dijo el dueño ("vendimos 4,850"), para cruzarlo con el desglose */
  statedTotalCents: number | null
  cashCents: number | null
  cardCents: number | null
  otherCents: number | null
  tipsCents: number | null
}

export interface Interpretation {
  intent: 'register_sales' | 'other'
  sales: SalesExtraction | null
}

export interface InterpretInput {
  text: string
  /** AAAA-MM-DD en la zona horaria del negocio */
  today: string
  currency: Currency
  /** Si hay una confirmación pendiente, su resumen, para que el intérprete resuelva correcciones */
  pendingSummary?: string
}

export interface Interpreter {
  interpret(input: InterpretInput): Promise<Interpretation>
}

/** Venta del día ya validada. Las propinas van aparte y NO cuentan como venta. */
export interface SalesDraft {
  date: string
  cashCents: number
  cardCents: number
  /** Transferencias, otros métodos, o monto sin desglosar */
  otherCents: number
  tipsCents: number
}

export interface Pending {
  kind: 'sales'
  draft: SalesDraft
  createdAt: string
}

export interface AssistantStore {
  getPending(): Promise<Pending | null>
  setPending(p: Pending | null): Promise<void>
  insertSale(draft: SalesDraft): Promise<void>
  /** Total ya registrado para esa fecha (centavos), para avisar de posibles duplicados */
  salesTotalOn(date: string): Promise<number>
}
