'use client'
// components/trustseal/command/command-gate.tsx  (asq-trustseal-billing-b4)
// Pro gate for the Command Center. The AUTHORITY is server-side: it calls the
// entitlement-checked /api/trustseal/command/access and renders the (heavy) command
// surface ONLY on a 200. Non-Pro / signed-out users get an upgrade / sign-in panel
// instead. The page stays a static shell — the command surface is not in the
// prerendered HTML; it mounts client-side only after the server grants access.
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/components/auth/auth-provider'
import { AuthButton } from '@/components/auth/auth-button'
import { CommandCenter } from '@/components/trustseal/command/command-center'

type GateState = 'checking' | 'entitled' | 'denied' | 'anon'

const shell = {
  minHeight: '60vh',
  background: 'radial-gradient(1000px 520px at 70% -12%, rgba(56,189,248,0.10), transparent 60%), #050811',
  color: '#e6edf7',
}

function Panel({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center px-6 py-24" style={shell}>
      <div className="max-w-md rounded-2xl border p-8 text-center" style={{ borderColor: 'rgba(120,160,255,0.18)', background: 'rgba(8,12,22,0.6)' }}>
        <div className="mx-auto mb-4 grid h-10 w-10 place-items-center">
          <svg viewBox="0 0 40 40" className="h-10 w-10"><defs><linearGradient id="cg-seal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs><polygon points="20,3 34,11 34,29 20,37 6,29 6,11" fill="none" stroke="url(#cg-seal)" strokeWidth="2" /></svg>
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm" style={{ color: '#9aa7c2' }}>{body}</p>
        <div className="mt-5 flex justify-center">{action}</div>
      </div>
    </div>
  )
}

function Gate({ locale }: { locale: string }) {
  const { user, loading } = useAuth()
  const [state, setState] = useState<GateState>('checking')

  useEffect(() => {
    if (loading) return
    if (!user?.idToken) { setState('anon'); return }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/trustseal/command/access', { headers: { Authorization: `Bearer ${user.idToken}` }, cache: 'no-store' })
        if (!cancelled) setState(r.ok ? 'entitled' : 'denied')
      } catch {
        if (!cancelled) setState('denied')
      }
    })()
    return () => { cancelled = true }
  }, [user?.idToken, loading])

  if (loading || state === 'checking') {
    return <Panel title="Trust Intelligence" body="Checking access…" action={<span />} />
  }
  if (state === 'entitled') return <CommandCenter locale={locale} />
  if (state === 'anon') {
    return <Panel title="Command Center" body="Sign in to your TrustSeal account to access the Trust Intelligence Command Center." action={<AuthButton />} />
  }
  return (
    <Panel
      title="Pro feature"
      body="The Trust Intelligence Command Center is part of TrustSeal Pro. Upgrade from your dashboard to unlock it."
      action={<a href={`/${locale}/dashboard`} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: '#22d3ee', color: '#06121e' }}>Go to billing</a>}
    />
  )
}

export function CommandGate({ locale }: { locale: string }) {
  return (
    <AuthProvider>
      <Gate locale={locale} />
    </AuthProvider>
  )
}
