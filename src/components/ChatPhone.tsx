import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MSG } from '../shared/messages.ts'
import type { ChatBackend } from '../lib/backend.ts'

interface Bubble {
  id: number
  from: 'me' | 'bot'
  text: string
  at: Date
}

const EXAMPLES = [
  'Hoy vendimos 4,850: 3,200 efectivo y 1,650 tarjeta',
  'Ayer vendimos Q2,300, propinas 150',
  'Efectivo 1800, tarjeta 950',
]

export function ChatPhone({ backend, onSaved }: { backend: ChatBackend; onSaved: () => void }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bubbles, busy])

  const awaitingConfirmation = bubbles.at(-1)?.from === 'bot' && bubbles.at(-1)!.text.endsWith(MSG.confirmSuffix)

  async function send(raw: string) {
    const msg = raw.trim()
    if (!msg || busy) return
    const push = (from: Bubble['from'], t: string) =>
      setBubbles((b) => [...b, { id: nextId.current++, from, text: t, at: new Date() }])
    push('me', msg)
    setText('')
    setBusy(true)
    try {
      const replies = await backend.send(msg)
      replies.forEach((r) => push('bot', r))
      onSaved()
    } catch {
      push('bot', MSG.trouble)
    } finally {
      setBusy(false)
    }
  }

  const time = (d: Date) =>
    d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', timeZone: backend.business.timezone })

  return (
    <section
      aria-label="Simulador de chat"
      className="mx-auto flex h-full max-h-[760px] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-wa-bg shadow-xl ring-1 ring-black/10"
    >
      <header className="flex items-center gap-3 bg-wa-header px-4 py-3 text-white">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-white/20 text-lg" aria-hidden>
          🧾
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Monterroso Chat</p>
          <p className="text-xs text-white/70">{busy ? 'escribiendo…' : 'asistente de ' + backend.business.name}</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4" role="log" aria-live="polite">
        {bubbles.length === 0 && (
          <div className="mx-auto max-w-[85%] rounded-lg bg-white/80 p-3 text-center text-xs text-slate-600 shadow-sm">
            Cuénteme las ventas del día y yo las anoto. Pruebe con un ejemplo 👇
          </div>
        )}
        {bubbles.map((b) => (
          <div key={b.id} className={`flex ${b.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-sm ${
                b.from === 'me' ? 'bg-wa-out' : 'bg-white'
              }`}
            >
              {b.text}
              <span className="ml-2 inline-block translate-y-1 text-[10px] text-slate-500">{time(b.at)}</span>
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-400 shadow-sm">…</div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="flex flex-wrap gap-2 px-3 pb-2">
        {awaitingConfirmation
          ? ['Sí', 'No'].map((c) => (
              <button
                key={c}
                onClick={() => send(c)}
                disabled={busy}
                className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-wa-header shadow-sm ring-1 ring-black/5 hover:bg-slate-50 disabled:opacity-50"
              >
                {c}
              </button>
            ))
          : bubbles.length === 0 &&
            EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => send(ex)}
                disabled={busy}
                className="rounded-full bg-white px-3 py-1.5 text-left text-xs text-slate-700 shadow-sm ring-1 ring-black/5 hover:bg-slate-50 disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
      </div>

      <form
        className="flex items-center gap-2 bg-[#f0f2f5] p-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escriba un mensaje"
          maxLength={2000}
          aria-label="Mensaje"
          className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-sm outline-none ring-1 ring-black/5 focus:ring-wa-send"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Enviar"
          className="grid h-10 w-10 place-items-center rounded-full bg-wa-send text-white disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </form>
    </section>
  )
}
