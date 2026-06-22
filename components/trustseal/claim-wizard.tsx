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
import { trackEvent } from '@/lib/track-event'

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

// Phase 3 — DNS help. Official provider docs for adding a TXT record.
const PROVIDERS: [string, string][] = [
  ['Hostinger', 'https://support.hostinger.com/en/articles/1583227-how-to-set-up-dns-records-at-hostinger'],
  ['Cloudflare', 'https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/'],
  ['GoDaddy', 'https://www.godaddy.com/help/add-a-txt-record-19232'],
  ['Namecheap', 'https://www.namecheap.com/support/knowledgebase/article.aspx/317/2237/how-do-i-add-txtspfdkimdmarc-records-for-my-domain/'],
]

function DnsHelp() {
  const border = 'rgb(var(--ts-border))'
  return (
    <details className="mt-4 rounded-lg border" style={{ borderColor: border }}>
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium" style={{ color: 'rgb(var(--ts-text-1))' }}>What is a DNS TXT record?</summary>
      <div className="space-y-3 border-t px-3 py-3 text-sm" style={{ borderColor: border, color: 'rgb(var(--ts-text-2))' }}>
        <p>A DNS TXT record is a small piece of text you add to your domain’s settings to prove you own it. You add it once, where you manage your domain (your registrar or hosting provider) — no coding, and it does not affect your website or email.</p>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide">Example</span>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>Sample</span>
          </div>
          <div className="rounded-lg border p-2 font-mono text-xs" style={{ borderColor: border, backgroundColor: 'rgb(var(--ts-bg))', color: 'rgb(var(--ts-text-1))' }}>
            <div>Type: <span style={{ color: 'rgb(var(--ts-accent-soft))' }}>TXT</span></div>
            <div>Host: <span style={{ color: 'rgb(var(--ts-accent-soft))' }}>@</span></div>
            <div className="break-all">Value: <span style={{ color: 'rgb(var(--ts-accent-soft))' }}>trustseal-verification=example123</span></div>
          </div>
          <p className="mt-1 text-xs">Use the exact Host and Value shown above in your own DNS panel — the values here are just an illustration.</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide">How to add it with your provider</p>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map(([n, u]) => (
              <a key={n} href={u} target="_blank" rel="noopener noreferrer" className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: border, color: 'rgb(var(--ts-text-1))' }}>{n} ↗</a>
            ))}
          </div>
        </div>
        <p className="text-xs">Most domains verify within a few minutes after the record is added (occasionally up to a few hours while DNS updates).</p>
      </div>
    </details>
  )
}

export function ClaimWizard({ onVerified, locale = 'en' as Locale }: { onVerified?: () => void; locale?: Locale }) {
  const x = (k: string) => t(locale, k)
  const L = (s: string) => `/${locale}${s}`
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

          {/* Phase 3 — DNS help for non-technical owners */}
          <DnsHelp />
          <p className="mt-3 text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>Most domains verify within a few minutes after the record is added.</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => { trackEvent('verify_domain', { domain }); void verify() }} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: okColor, color: '#fff' }}>
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

      {/* ── verified: success + activation (Phase 4) ── */}
      {phase === 'verified' && (
        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-bg))' }}>
          <p className="text-base font-semibold" style={{ color: okColor }}>✓ {domain} is verified</p>
          <p className="mt-1 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>
            Your domain is verified. Now show visitors that your business is trusted.
          </p>

          {/* Prominent activation actions */}
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={L(`/trust/${encodeURIComponent(domain)}`)} target="_blank" rel="noopener noreferrer" className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: okColor, color: '#fff' }}>View public trust page ↗</a>
            <a href={L(`/certificate/${encodeURIComponent(domain)}`)} target="_blank" rel="noopener noreferrer" className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-1))' }}>Download certificate ↗</a>
          </div>

          {/* Get the website badge — honest Pro requirement, not hidden */}
          <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'rgb(var(--ts-border))' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>Get the website badge</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'rgba(34,211,238,0.12)', color: 'rgb(var(--ts-accent))', border: '1px solid rgb(var(--ts-border))' }}>Pro</span>
            </div>
            <p className="mt-1 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>The embeddable badge that displays your verified status on your website is a Pro feature.</p>
            <a href={L('/pricing')} className="mt-3 inline-block rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'rgb(var(--ts-accent))', color: 'rgb(var(--ts-accent))' }}>Upgrade to display the TrustSeal badge on your website</a>
          </div>

          <button onClick={reset} className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-1))' }}>
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
