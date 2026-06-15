'use client'

import { useState } from 'react'
import { useAuth } from './auth-provider'

interface AuthLabels {
  signIn?: string; signOut?: string; greeting?: string
  continueGoogle?: string; email?: string; password?: string
  createAccount?: string; or?: string; switchToSignUp?: string; switchToSignIn?: string
  notConfigured?: string; signInFailed?: string; googleFailed?: string
}

export function AuthButton({ labels }: { labels?: AuthLabels } = {}) {
  const { user, configured, signInEmail, signUpEmail, signInGoogle, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const L = (k: keyof AuthLabels, d: string) => labels?.[k] ?? d

  if (user) return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-400">{L('greeting', 'Hi')}, {user.name}</span>
      <button onClick={signOut} className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500">{L('signOut', 'Sign out')}</button>
    </div>
  )

  const submit = async () => {
    setErr(''); setBusy(true)
    try { await (mode === 'in' ? signInEmail(email, pw) : signUpEmail(email, pw)); setOpen(false) }
    catch (e) { setErr(e instanceof Error ? e.message : L('signInFailed', 'Sign-in failed')) } finally { setBusy(false) }
  }
  const google = async () => { setErr(''); setBusy(true); try { await signInGoogle(); setOpen(false) } catch (e) { setErr(e instanceof Error ? e.message : L('googleFailed', 'Google sign-in failed')) } finally { setBusy(false) } }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700">{L('signIn', 'Sign in')}</button>
      {open && (
        <div className="absolute end-0 z-20 mt-2 w-72 rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
          {!configured && <p className="mb-2 rounded bg-amber-500/10 p-2 text-xs text-amber-300">{L('notConfigured', 'Auth not configured yet.')}</p>}
          <button onClick={google} disabled={busy} className="mb-3 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:border-zinc-500 disabled:opacity-50">{L('continueGoogle', 'Continue with Google')}</button>
          <div className="mb-2 text-center text-[11px] uppercase tracking-wide text-zinc-600">{L('or', 'or')}</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={L('email', 'Email')} className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder={L('password', 'Password')} className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          {err && <p className="mb-2 text-xs text-red-400">{err}</p>}
          <button onClick={submit} disabled={busy || !email || !pw} className="w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50">{mode === 'in' ? L('signIn', 'Sign in') : L('createAccount', 'Create account')}</button>
          <button onClick={() => setMode((m) => (m === 'in' ? 'up' : 'in'))} className="mt-2 w-full text-center text-xs text-sky-400 hover:underline">{mode === 'in' ? L('switchToSignUp', 'New here? Create an account') : L('switchToSignIn', 'Have an account? Sign in')}</button>
        </div>
      )}
    </div>
  )
}
