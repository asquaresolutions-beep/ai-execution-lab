'use client'
// components/trustseal/dashboard-client.tsx  (asq-trustseal-pr1; i18n standalone)
// Client-only TrustSeal dashboard shell. Auth is ENTIRELY client-side (localStorage
// session via the reused AuthProvider), so the parent /trustseal/[locale] layout
// stays fully static. Fully localized: all visible strings via t(locale, 'dash.*');
// the selected locale flows down to the claim wizard, claims list and billing.
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/components/auth/auth-provider'
import { AuthButton } from '@/components/auth/auth-button'
import { ClaimWizard } from '@/components/trustseal/claim-wizard'
import { ClaimsList } from '@/components/trustseal/claims-list'
import { BillingSection } from '@/components/trustseal/billing/billing-section'
import { ApiAccessSection } from '@/components/trustseal/api-access-section'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

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

function DashboardInner({ locale }: { locale: Locale }) {
  const x = (k: string) => t(locale, k)
  const { user, loading, configured } = useAuth()
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claimsRefresh, setClaimsRefresh] = useState(0)
  const authLabels = {
    signIn: x('nav.signIn'), signOut: x('nav.signOut'), greeting: x('dash.greeting'),
    continueGoogle: x('auth.continueGoogle'), email: x('auth.email'), password: x('auth.password'),
    createAccount: x('auth.createAccount'), or: x('auth.or'),
    switchToSignUp: x('auth.switchToSignUp'), switchToSignIn: x('auth.switchToSignIn'),
    notConfigured: x('auth.notConfigured'), signInFailed: x('auth.signInFailed'), googleFailed: x('auth.googleFailed'),
  }

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
    return <p className="text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('dash.loading')}</p>
  }

  if (!configured) {
    return (
      <div className="rounded-xl border p-4 text-sm" style={{ ...card, color: 'rgb(var(--ts-text-2))' }}>
        {x('dash.notConfigured')}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="rounded-xl border p-6" style={card}>
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('dash.signInTitle')}</h2>
        <p className="mt-2 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('dash.signInBody')}</p>
        <div className="mt-4"><AuthButton labels={authLabels} /></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border p-4" style={card}>
        <div>
          <p className="text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('dash.signedInAs')}</p>
          <p className="text-base font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>
            {account?.email || user.email}
          </p>
        </div>
        <AuthButton labels={authLabels} />
      </div>

      {error && (
        <p className="text-sm" style={{ color: '#f87171' }}>{x('dash.accountError')}: {error}</p>
      )}

      <ClaimWizard locale={locale} onVerified={() => setClaimsRefresh((n) => n + 1)} />
      <ClaimsList locale={locale} refreshKey={claimsRefresh} />
      <BillingSection locale={locale} />
      <ApiAccessSection locale={locale} />
    </div>
  )
}

export function DashboardClient({ locale }: { locale: string }) {
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  return (
    <AuthProvider>
      <main className="mx-auto max-w-3xl px-6 py-12" data-locale={lc}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--ts-accent))' }}>
          {t(lc, 'dash.kicker')}
        </p>
        <h1 className="mt-2 mb-6 text-2xl font-bold" style={{ color: 'rgb(var(--ts-text-1))' }}>{t(lc, 'dash.title')}</h1>
        <DashboardInner locale={lc} />
      </main>
    </AuthProvider>
  )
}
