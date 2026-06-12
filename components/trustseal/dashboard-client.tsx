'use client'
// components/trustseal/dashboard-client.tsx  (asq-trustseal-pr1)
// Client-only TrustSeal dashboard shell. Auth is ENTIRELY client-side (localStorage
// session via the reused AuthProvider), so the parent /trustseal/[locale] layout
// stays fully static — SSG preserved, no server session reads, dynamicParams=false
// untouched. Signed-in users call the authenticated /api/trustseal/account endpoint
// (Bearer ID token) to bootstrap their ts_accounts row.
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/components/auth/auth-provider'
import { AuthButton } from '@/components/auth/auth-button'
import { ClaimWizard } from '@/components/trustseal/claim-wizard'
import { ClaimsList } from '@/components/trustseal/claims-list'

interface AccountInfo {
  uid: string
  email: string
  displayName: string | null
  createdAt: number
  lastSeenAt: number
}

const card = {
  borderColor: 'rgb(var(--ts-border))',
  backgroundColor: 'rgb(var(--ts-surface-2))',
} as const

function DashboardInner() {
  const { user, loading, configured } = useAuth()
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claimsRefresh, setClaimsRefresh] = useState(0)

  useEffect(() => {
    if (!user?.idToken) { setAccount(null); return }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/trustseal/account', {
          headers: { Authorization: `Bearer ${user.idToken}` },
          cache: 'no-store',
        })
        if (!r.ok) throw new Error(`account ${r.status}`)
        const data = (await r.json()) as AccountInfo
        if (!cancelled) { setAccount(data); setError(null) }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'account error')
      }
    })()
    return () => { cancelled = true }
  }, [user?.idToken])

  if (loading) {
    return <p className="text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>Loading…</p>
  }

  if (!configured) {
    return (
      <div className="rounded-xl border p-4 text-sm" style={{ ...card, color: 'rgb(var(--ts-text-2))' }}>
        Sign-in is not configured for this environment.
      </div>
    )
  }

  if (!user) {
    return (
      <div className="rounded-xl border p-6" style={card}>
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>Sign in to your dashboard</h2>
        <p className="mt-2 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>
          Manage your verified domains, badge and billing.
        </p>
        <div className="mt-4"><AuthButton /></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border p-4" style={card}>
        <div>
          <p className="text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>Signed in as</p>
          <p className="text-base font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>
            {account?.email || user.email}
          </p>
        </div>
        <AuthButton />
      </div>

      {error && (
        <p className="text-sm" style={{ color: '#f87171' }}>Could not load account: {error}</p>
      )}

      <ClaimWizard onVerified={() => setClaimsRefresh((n) => n + 1)} />
      <ClaimsList refreshKey={claimsRefresh} />
    </div>
  )
}

export function DashboardClient({ locale }: { locale: string }) {
  return (
    <AuthProvider>
      <main className="mx-auto max-w-3xl px-6 py-12" data-locale={locale}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--ts-accent))' }}>
          TrustSeal · Dashboard
        </p>
        <h1 className="mt-2 mb-6 text-2xl font-bold" style={{ color: 'rgb(var(--ts-text-1))' }}>Dashboard</h1>
        <DashboardInner />
      </main>
    </AuthProvider>
  )
}
