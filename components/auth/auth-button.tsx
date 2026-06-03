'use client'

import { useState } from 'react'
import { useAuth } from './auth-provider'

export function AuthButton() {
  const { user, configured, signInEmail, signUpEmail, signInGoogle, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

  if (user) return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-400">Hi, {user.name}</span>
      <button onClick={signOut} className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500">Sign out</button>
    </div>
  )

  const submit = async () => {
    setErr(''); setBusy(true)
    try { await (mode === 'in' ? signInEmail(email, pw) : signUpEmail(email, pw)); setOpen(false) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Sign-in failed') } finally { setBusy(false) }
  }
  const google = async () => { setErr(''); setBusy(true); try { await signInGoogle(); setOpen(false) } catch (e) { setErr(e instanceof Error ? e.message : 'Google sign-in failed') } finally { setBusy(false) } }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700">Sign in</button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
          {!configured && <p className="mb-2 rounded bg-amber-500/10 p-2 text-xs text-amber-300">Auth not configured yet. Set NEXT_PUBLIC_FIREBASE_API_KEY.</p>}
          <button onClick={google} disabled={busy} className="mb-3 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:border-zinc-500 disabled:opacity-50">Continue with Google</button>
          <div className="mb-2 text-center text-[11px] uppercase tracking-wide text-zinc-600">or</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="Password" className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          {err && <p className="mb-2 text-xs text-red-400">{err}</p>}
          <button onClick={submit} disabled={busy || !email || !pw} className="w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50">{mode === 'in' ? 'Sign in' : 'Create account'}</button>
          <button onClick={() => setMode((m) => (m === 'in' ? 'up' : 'in'))} className="mt-2 w-full text-center text-xs text-sky-400 hover:underline">{mode === 'in' ? 'New here? Create an account (50 scans/day)' : 'Have an account? Sign in'}</button>
        </div>
      )}
    </div>
  )
}
