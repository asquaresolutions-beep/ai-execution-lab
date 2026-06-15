'use client'
// components/trustseal/claims-list.tsx  (asq-trustseal-pr3)
// Lists the signed-in user's domain claims from GET /api/trustseal/claims (which
// uses the ts_claims (accountId, createdAt) composite index). Reloads when
// `refreshKey` changes (e.g. after a successful verify in the claim wizard).
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

interface ClaimRow {
  domain: string
  status: 'pending' | 'verified' | 'failed' | 'revoked' | string
  method: string
  verifiedAt: number | null
  createdAt: number
}

const card = { borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-surface-2))' } as const

const STATUS_COLOR: Record<string, string> = {
  verified: 'rgb(var(--ts-accent))',
  pending: 'rgb(var(--ts-text-2))',
  failed: '#f87171',
  revoked: '#f87171',
}

const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString() : '—')

export function ClaimsList({ refreshKey = 0, locale = 'en' as Locale }: { refreshKey?: number; locale?: Locale }) {
  const x = (k: string) => t(locale, k)
  const statusLabel = (s: string) => x(`dash.status${s.charAt(0).toUpperCase()}${s.slice(1)}`)
  const { user } = useAuth()
  const [claims, setClaims] = useState<ClaimRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.idToken) { setClaims([]); return }
    try {
      const r = await fetch('/api/trustseal/claims', { headers: { Authorization: `Bearer ${user.idToken}` }, cache: 'no-store' })
      if (!r.ok) throw new Error(`claims ${r.status}`)
      const b = await r.json()
      setClaims(Array.isArray(b.claims) ? b.claims : [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'claims error')
    }
  }, [user?.idToken])

  useEffect(() => { void load() }, [load, refreshKey])

  const [removing, setRemoving] = useState<string | null>(null)
  const remove = useCallback(async (domain: string) => {
    if (!user?.idToken || removing) return
    if (!window.confirm(x('dash.removeConfirm').replace('{domain}', domain))) return
    setRemoving(domain)
    try {
      const r = await fetch('/api/trustseal/claim/remove', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      if (!r.ok) { const d = (await r.json()) as { error?: string }; setError(d.error || 'remove failed'); return }
      await load()
    } catch {
      setError('remove failed')
    } finally {
      setRemoving(null)
    }
  }, [user?.idToken, removing, load])

  return (
    <section className="rounded-xl border p-6" style={card}>
      <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('dash.domainsTitle')}</h2>

      {error && <p className="mt-2 text-sm" style={{ color: '#f87171' }}>{x('dash.domainsError')}: {error}</p>}

      {claims === null && !error && (
        <p className="mt-2 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('dash.loading')}</p>
      )}

      {claims !== null && claims.length === 0 && (
        <p className="mt-2 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>
          {x('dash.domainsEmpty')}
        </p>
      )}

      {claims !== null && claims.length > 0 && (
        <ul className="mt-3 divide-y" style={{ borderColor: 'rgb(var(--ts-border))' }}>
          {claims.map((c) => (
            <li key={c.domain} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium" style={{ color: 'rgb(var(--ts-text-1))' }}>{c.domain}</p>
                <p className="text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>
                  {c.method.toUpperCase()} · {x('dash.added')} {fmt(c.createdAt)}{c.verifiedAt ? ` · ${x('dash.verifiedOn')} ${fmt(c.verifiedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border px-2 py-0.5 text-xs font-semibold"
                  style={{ borderColor: 'rgb(var(--ts-border))', color: STATUS_COLOR[c.status] ?? 'rgb(var(--ts-text-2))' }}>
                  {statusLabel(c.status)}
                </span>
                {/* Remove only NON-verified claims; verified ownership has no Remove. */}
                {c.status !== 'verified' && (
                  <button type="button" disabled={removing === c.domain} onClick={() => void remove(c.domain)}
                    aria-label={`${x('dash.remove')} ${c.domain}`} title={x('dash.remove')}
                    className="rounded-md border px-2 py-0.5 text-xs disabled:opacity-50"
                    style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-2))' }}>
                    {removing === c.domain ? x('dash.removing') : x('dash.remove')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
