// components/trustseal/seal-view.tsx  (asq-trustseal-pr4)
// Public seal/trust page presentation. SERVER component (no client JS) so the
// verdict content is server-rendered for SEO. Renders only the public projection.
import Link from 'next/link'
import type { SealData } from '@/lib/trustseal/seal'
import { t } from '@/lib/trustseal/messages'
import { formatDate } from '@/lib/trustseal/format'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'
import { bandMeta } from '@/lib/trustseal/band'

const TRUST_BASE = (process.env.TRUSTSEAL_BASE_URL || 'https://trustseal.asquaresolution.com').replace(/\/$/, '')

const card = { borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-surface-2))' } as const

const humanize = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export function SealView({ data, locale }: { data: SealData; locale: string }) {
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const x = (k: string) => t(lc, k)
  const fmt = (ms: number | null) => formatDate(lc, ms)
  const r = data.report
  const meta = bandMeta(r?.band ?? 'verified')
  const bandLabel = (b: string) => x(bandMeta(b).labelKey)
  const embed = `<script src="${TRUST_BASE}/badge.js" data-domain="${data.domain}"></script>`
  // JSON-LD: honest Organization + a verification record (no fabricated ratings).
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.domain,
    url: `https://${data.domain}`,
    subjectOf: {
      '@type': 'CreativeWork',
      name: 'TrustSeal domain verification',
      dateCreated: new Date(data.verifiedAt).toISOString(),
      creator: { '@type': 'Organization', name: 'TrustSeal', url: TRUST_BASE },
    },
  }
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TrustSeal', item: TRUST_BASE },
      { '@type': 'ListItem', position: 2, name: `${data.domain} verification`, item: `${TRUST_BASE}/${locale}/trust/${data.domain}` },
    ],
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <nav className="text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>
        <Link href={`/${locale}`} className="hover:underline" style={{ color: 'rgb(var(--ts-accent))' }}>TrustSeal</Link> / {data.domain}
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ background: meta.color, color: '#06121e' }}>{meta.icon}</span>
        <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: 'rgb(var(--ts-text-1))' }}>{data.domain}</h1>
        {/* Band chip (Badge V2): color + icon + localized level name */}
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}` }}>
          <span aria-hidden>{meta.icon}</span>{r ? bandLabel(r.band) : x('seal.ownershipVerifiedShort')}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold" style={{ color: 'rgb(var(--ts-accent))' }}>
        {x('seal.ownershipVerified')}
      </p>

      {/* Verification facts */}
      <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border sm:grid-cols-2" style={{ borderColor: 'rgb(var(--ts-border))' }}>
        <Fact label={x('seal.status')} value={r ? bandLabel(r.band) : x('seal.ownershipVerifiedShort')} accent />
        <Fact label={x('seal.method')} value={data.method.toUpperCase()} />
        <Fact label={x('seal.verifiedOn')} value={fmt(data.verifiedAt)} />
        <Fact label={x('seal.lastChecked')} value={fmt(data.lastCheckedAt)} />
      </dl>

      {/* Business / domain summary (if a verdict exists) */}
      {r ? (
        <section className="mt-6 rounded-xl border p-5" style={card}>
          <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('seal.trustSummary')}</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>
            {x('seal.trustScore')} <strong style={{ color: 'rgb(var(--ts-text-1))' }}>{r.score}/100</strong> · {x('seal.confidence')} {(r.confidence * 100).toFixed(0)}%
            {r.partial ? ` · ${x('seal.partial')}` : ''}
          </p>
          {r.badges?.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('seal.publicSignals')}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {r.badges.map((b) => (
                  <li key={b} className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-2))' }}>
                    {humanize(b)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Explainable score (Part 3): per-category sub-scores + confidence */}
          {r.categories?.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('seal.scoreBreakdown')}</p>
              <ul className="mt-2 space-y-2">
                {r.categories.map((c) => (
                  <li key={c.category}>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'rgb(var(--ts-text-1))' }}>{humanize(c.category)}</span>
                      <span style={{ color: 'rgb(var(--ts-text-2))' }}>{c.covered ? `${Math.round(c.subScore)}/100` : x('seal.coveredNo')}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgb(var(--ts-border))' }}>
                      <div className="h-full rounded-full" style={{ width: `${c.covered ? Math.max(0, Math.min(100, c.subScore)) : 0}%`, background: meta.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reasoning: per-signal proof (id + status + evidence) */}
          {r.signals?.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('seal.reasoning')}</p>
              <ul className="mt-2 space-y-1.5">
                {r.signals.slice(0, 10).map((s) => (
                  <li key={s.id} className="flex items-start gap-2 text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>
                    <span aria-hidden style={{ color: s.status === 'pass' || s.status === 'ok' ? meta.color : 'rgb(var(--ts-text-3))' }}>•</span>
                    <span><strong style={{ color: 'rgb(var(--ts-text-1))' }}>{humanize(s.id)}</strong>{s.evidence ? ` — ${s.evidence}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-6 rounded-xl border p-5" style={card}>
          <p className="text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>
            {x('seal.preparing')}
          </p>
        </section>
      )}

      {/* Badge preview / embed — every verified domain can publish its live badge */}
      <section className="mt-6 rounded-xl border p-5" style={card}>
        <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('seal.badgePreview')}</h2>
        <span dir="ltr" className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-1))' }}>
          <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: meta.color, color: '#fff' }}>{meta.icon}</span>
          {r ? bandLabel(r.band) : x('seal.ownershipVerifiedShort')} · <strong>TrustSeal</strong>
        </span>
        <p className="mt-3 text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('seal.embedHint')}</p>
        <code dir="ltr" className="mt-2 block overflow-x-auto rounded-lg border p-3 text-xs" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-1))', backgroundColor: 'rgb(var(--ts-bg))' }}>{embed}</code>
      </section>

      <footer className="mt-8 text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>
        {x('seal.verificationBy')} <Link href={`/${locale}`} className="hover:underline" style={{ color: 'rgb(var(--ts-accent))' }}>TrustSeal</Link> · {x('seal.publicRecord')}.
      </footer>
    </main>
  )
}

function Fact({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-4" style={{ backgroundColor: 'rgb(var(--ts-surface-2))' }}>
      <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgb(var(--ts-text-2))' }}>{label}</dt>
      <dd className="mt-1 text-sm font-semibold" style={{ color: accent ? 'rgb(var(--ts-accent))' : 'rgb(var(--ts-text-1))' }}>{value}</dd>
    </div>
  )
}
