import { formatDateEs } from '../shared/dates.ts'
import { formatMoney } from '../shared/money.ts'
import type { SaleRow } from '../lib/backend.ts'
import type { Currency } from '../shared/types.ts'

export function LedgerPanel({ sales, currency, error }: { sales: SaleRow[]; currency: Currency; error?: string }) {
  const money = (c: number) => formatMoney(c, currency)
  const total = sales.reduce((n, s) => n + s.totalCents, 0)
  const tips = sales.reduce((n, s) => n + s.tipsCents, 0)

  return (
    <section aria-label="Libro de ventas" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="text-base font-semibold">Ventas registradas</h2>
      <p className="mb-3 text-xs text-slate-500">
        Se actualiza cuando usted confirma con "sí". Las propinas van aparte y no suman a la venta.
      </p>
      {error && <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {sales.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Todavía no hay ventas anotadas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">Día</th>
                <th className="py-1 pr-3 text-right font-medium">Efectivo</th>
                <th className="py-1 pr-3 text-right font-medium">Tarjeta</th>
                <th className="py-1 pr-3 text-right font-medium">Otros</th>
                <th className="py-1 pr-3 text-right font-medium">Total</th>
                <th className="py-1 text-right font-medium">Propinas</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 first-letter:uppercase">{formatDateEs(s.date)}</td>
                  <td className="py-1.5 pr-3 text-right">{s.cashCents ? money(s.cashCents) : '–'}</td>
                  <td className="py-1.5 pr-3 text-right">{s.cardCents ? money(s.cardCents) : '–'}</td>
                  <td className="py-1.5 pr-3 text-right">{s.otherCents ? money(s.otherCents) : '–'}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold">{money(s.totalCents)}</td>
                  <td className="py-1.5 text-right text-slate-500">{s.tipsCents ? money(s.tipsCents) : '–'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="tabular-nums">
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="pt-2" colSpan={4}>
                  Suma
                </td>
                <td className="pt-2 pr-3 text-right">{money(total)}</td>
                <td className="pt-2 text-right text-slate-500">{money(tips)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
