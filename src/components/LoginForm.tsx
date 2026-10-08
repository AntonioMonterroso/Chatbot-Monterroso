import { useState } from 'react'
import { supabase } from '../lib/supabase.ts'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError('No se pudo iniciar sesión. Revise el correo y la contraseña.')
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-16 w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h1 className="text-lg font-semibold">Monterroso Chat</h1>
      <label className="block text-sm">
        Correo
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Contraseña
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded bg-wa-send py-2 font-medium text-white disabled:opacity-50">
        Entrar
      </button>
    </form>
  )
}
