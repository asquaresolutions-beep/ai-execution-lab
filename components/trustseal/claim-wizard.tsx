'use client'
// components/trustseal/claim-wizard.tsx  (asq-trustseal-pr3)
// Customer-facing domain-claim flow. Consumes the PR-2 APIs (start/verify/status)
// with the logged-in user's Bearer ID token (via useAuth). State machine:
//   idle → pending (show TXT instructions) → verifying → verified | error
// No billing, no badge, no seal — ownership UX only.
import { useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

type Phase = 'idle' | 'pending' | 'verifying' | 'verified' | 'error'
interface DnsRecord { name: string; type: string; value: string }

const card = { borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-surface-2))' } as const
const danger = '#f87171'
const okColor = 'rgb(var(--ts-accent))'

/** Map API error codes → localized copy. */
function errorMessage(locale: Locale, code: string | undefined): string {
  const x = (k: string) => t(locale, k)
  switch (code) {
    case 'invalid_domain': return x('dash.errInvalidDomain')
    case 'already_claimed': return x('dash.errAlreadyClaimed')
    case 'txt_not_found': return x('dash.errTxtNotFound')
    case 'token_expired': return x('dash.errExpired')
    case 'rate_limited': return x('dash.errRateLimited')
    case 'domain is required': return x('dash.errEnterDomain')
    case 'unauthorized': return x('dash.errUnauthorized')
    default: return x('dash.errGeneric')
  }
}

export function ClaimWizard({ onVerified, locale = 'en' as Locale }: { onVerified?: () => void; locale?: Locale }) {
  const x = (k: string) => t(locale, k)
  const { user } = useAuth()
  const [phase, setPhase] = useState<Phase>('idle')
  const [domainInput, setDomainInput] = useState('')
  const [domain, setDomain] = useState('') // canonical, from the server
  const [record, setRecord] = useState<DnsRecord | null>(null)
  const [fallback, setFallback] = useState<DnsRecord | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')

  const authHeaders = (json = false): Record<string, string> => ({
    Authorization: `Bearer ${user?.idToken ?? ''}`,
    ...(json ? { 'content-type': 'application/json' } : {}),
  })

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key); setTimeout(() => setCopied(''), 1500)
    } catch { /* clipboard blocked — ignore */ }
  }

  const start = async () => {
    if (!domainInput.trim()) { setError(errorMessage(locale, 'domain is required')); return }
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/trustseal/claim/start', {
        method: 'POST', headers: authHeaders(true), body: JSON.stringify({ domain: domainInput.trim() }),
      })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) { setError(errorMessage(locale, b.error)); return }
      setDomain(b.domain); setRecord(b.record ?? null); setFallback(b.fallback ?? null)
      setPhase(b.status === 'verified' ? 'verified' : 'pending')
    } catch { setError(errorMessage(locale, undefined)) }
    finally { setBusy(false) }
  }

  const verify = async () => {
    setBusy(true); setError(''); setPhase('verifying')
    try {
      const r = await fetch('/api/trustseal/claim/verify', {
        method: 'POST', headers: authHeaders(true), body: JSON.stringify({ domain }),
      })
      const b = await r.json().catch(() => ({}))
      if (r.ok && b.status === 'verified') { setPhase('verified'); onVerified?.(); return }
      setError(errorMessage(locale, b.error)); setPhase('pending')
    } catch { setError(errorMessage(locale, undefined)); setPhase('pending') }
    finally { setBusy(false) }
  }

  const checkStatus = async () => {
    setBusy(true); setError('')
    try {
      const r = await fetch(`/api/trustseal/claim/status?domain=${encodeURIComponent(domain)}`, { headers: authHeaders() })
      const b = await r.json().catch(() => ({}))
      if (r.ok && b.status === 'verified') { setPhase('verified'); onVerified?.() }
    } catch { /* keep current phase */ }
    finally { setBusy(false) }
  }

  const reset = () => {
    setPhase('idle'); setDomainInput(''); setDomain(''); setRecord(null); setFallback(null); setError('')
  }

  return (
    <section className="rounded-xl border p-6" style={card} data-phase={phase}>
      <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('dash.verifyTitle')}</h2>
      <p className="mt-1 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>
        {x('dash.verifyBody')}
      </p>

      {/* ── idle: enter domain ── */}
      {phase === 'idle' && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text" inputMode="url" placeholder={x('dash.domainPlaceholder')} value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void start() }}
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-bg))', color: 'rgb(var(--ts-text-1))' }}
          />
          <button
            onClick={() => void start()} disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: okColor, color: '#fff' }}
          >
            {busy ? x('dash.starting') : x('dash.startClaim')}
          </button>
        </div>
      )}

      {/* ── pending / verifying: TXT instructions ── */}
      {(phase === 'pending' || phase === 'verifying') && record && (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: 'rgb(var(--ts-surface-2))', color: 'rgb(var(--ts-text-2))', border: '1px solid rgb(var(--ts-border))' }}>
              {phase === 'verifying' ? x('dash.verifying') : x('dash.pending')}
            </span>
            <span style={{ color: 'rgb(var(--ts-text-2))' }}>{x('dash.forDomain')} <strong style={{ color: 'rgb(var(--ts-text-1))' }}>{domain}</strong></span>
          </div>
          <p className="text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>
            {x('dash.txtInstruction')}
          </p>

          <CopyRow label={x('dash.nameHost')} value={record.name} copied={copied === 'name'} onCopy={() => copy('name', record.name)} copyLabel={x('dash.copy')} copiedLabel={x('dash.copied')} />
          <CopyRow label={x('dash.value')} value={record.value} copied={copied === 'value'} onCopy={() => copy('value', record.value)} copyLabel={x('dash.copy')} copiedLabel={x('dash.copied')} />
          {fallback && (
            <p className="mt-2 text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>
              {x('dash.fallbackHint')} <code style={{ color: 'rgb(var(--ts-accent-soft))' }}>{fallback.name}</code>.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => void verify()} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: okColor, color: '#fff' }}>
              {phase === 'verifying' ? x('dash.verifying') : x('dash.verifyOwnership')}
            </button>
            <button onClick={() => void checkStatus()} disabled={busy} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-1))' }}>
              {x('dash.checkStatus')}
            </button>
            <button onClick={reset} disabled={busy} className="rounded-lg px-3 py-2 text-sm disabled:opacity-50" style={{ color: 'rgb(var(--ts-text-2))' }}>
              {x('dash.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ── verified: success ── */}
      {phase === 'verified' && (
        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-bg))' }}>
          <p className="text-sm font-semibold" style={{ color: okColor }}>✓ {domain} {x('dash.verifiedSuffix')}</p>
          <p className="mt-1 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>
            {x('dash.verifiedBody')}
          </p>
          <button onClick={reset} className="mt-3 rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-1))' }}>
            {x('dash.verifyAnother')}
          </button>
        </div>
      )}

      {/* ── error banner (shown alongside idle/pending) ── */}
      {error && (
        <p className="mt-3 text-sm" role="alert" style={{ color: danger }}>{error}</p>
      )}
    </section>
  )
}

function CopyRow({ label, value, copied, onCopy, copyLabel = 'Copy', copiedLabel = 'Copied ✓' }: { label: string; value: string; copied: boolean; onCopy: () => void; copyLabel?: string; copiedLabel?: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgb(var(--ts-text-2))' }}>{label}</p>
      <div className="mt-1 flex items-stretch gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-bg))', color: 'rgb(var(--ts-text-1))' }}>
          {value}
        </code>
        <button onClick={onCopy} className="shrink-0 rounded-lg border px-3 text-xs font-medium" style={{ borderColor: 'rgb(var(--ts-border))', color: copied ? 'rgb(var(--ts-accent))' : 'rgb(var(--ts-text-1))' }} aria-label={`Copy ${label}`}>
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
    </div>
  )
}
