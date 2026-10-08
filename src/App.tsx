import { useCallback, useEffect, useState } from 'react'
import { ChatPhone } from './components/ChatPhone.tsx'
import { LedgerPanel } from './components/LedgerPanel.tsx'
import { LoginForm } from './components/LoginForm.tsx'
import type { ChatBackend, SaleRow } from './lib/backend.ts'
import { createDemoBackend } from './lib/demoBackend.ts'
import { createRemoteBackend } from './lib/remoteBackend.ts'
import { supabase } from './lib/supabase.ts'

export default function App() {
  const [backend, setBackend] = useState<ChatBackend | null>(() => (supabase ? null : createDemoBackend()))
  const [needsLogin, setNeedsLogin] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [sales, setSales] = useState<SaleRow[]>([])
  const [salesError, setSalesError] = useState('')
  const [chatKey, setChatKey] = useState(0)

  // Con Supabase configurado: esperar sesión y armar el backend real.
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    const connect = async (hasSession: boolean) => {
      if (!hasSession) {
        setBackend(null)
        setNeedsLogin(true)
        return
      }
      setNeedsLogin(false)
      try {
        setBackend(await createRemoteBackend(db))
        setLoadError('')
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'No se pudo cargar el negocio.')
      }
    }
    void db.auth.getSession().then(({ data }) => connect(!!data.session))
    const { data: sub } = db.auth.onAuthStateChange((_e, session) => void connect(!!session))
    return () => sub.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!backend) return
    try {
      setSales(await backend.listSales())
      setSalesError('')
    } catch {
      setSalesError('No se pudieron cargar las ventas.')
    }
  }, [backend])

  useEffect(() => {
    if (!backend) return
    let live = true
    backend
      .listSales()
      .then((rows) => live && setSales(rows))
      .catch(() => live && setSalesError('No se pudieron cargar las ventas.'))
    return () => {
      live = false
    }
  }, [backend])

  if (needsLogin) return <LoginForm />
  if (loadError) return <p className="p-6 text-sm text-red-700">{loadError}</p>
  if (!backend) return <p className="p-6 text-sm text-slate-500">Cargando…</p>

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Monterroso Chat</h1>
          <p className="text-sm text-slate-500">{backend.business.name}</p>
        </div>
        {backend.mode === 'demo' ? (
          <div className="flex items-center gap-3 text-xs">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
              Modo demo: datos inventados, se quedan en este navegador
            </span>
            <button
              className="underline"
              onClick={() => {
                backend.reset?.()
                setChatKey((k) => k + 1)
                void refresh()
              }}
            >
              Reiniciar demo
            </button>
          </div>
        ) : (
          <button className="text-xs underline" onClick={() => void supabase?.auth.signOut()}>
            Salir
          </button>
        )}
      </header>

      <div className="grid flex-1 gap-4 lg:grid-cols-[420px_1fr]">
        <div className="h-[640px] lg:h-[720px]">
          <ChatPhone key={chatKey} backend={backend} onSaved={() => void refresh()} />
        </div>
        <div>
          <LedgerPanel sales={sales} currency={backend.business.currency} error={salesError} />
        </div>
      </div>
    </div>
  )
}
