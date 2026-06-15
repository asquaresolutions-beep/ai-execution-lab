// components/trustseal/seal-view.tsx  (asq-trustseal-pr4)
// Public seal/trust page presentation. SERVER component (no client JS) so the
// verdict content is server-rendered for SEO. Renders only the public projection.
import Link from 'next/link'
import type { SealData } from '@/lib/trustseal/seal'
import { t } from '@/lib/trustseal/messages'
import { formatDate } from '@/lib/trustseal/format'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'

const TRUST_BASE = (process.env.TRUSTSEAL_BASE_URL || 'https://trustseal.asquaresolution.com').replace(/\/$/, '')

const card = { borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-surface-2))' } as const

// Band → localized trust-level name (reuses the homepage `levels` namespace).
const BAND_KEY: Record<string, string> = {
  verified: 'levels.verifiedName', established: 'levels.establishedName', limited: 'levels.limitedName',
  caution: 'levels.cautionName', high_risk: 'levels.riskName',
}

export function SealView({ data, locale }: { data: SealData; locale: string }) {
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const x = (k: string) => t(lc, k)
  const fmt = (ms: number | null) => formatDate(lc, ms)
  const bandLabel = (b: string) => (BAND_KEY[b] ? x(BAND_KEY[b]) : b)
  const embed = `<script src="${TRUST_BASE}/badge.js" data-domain="${data.domain}"></script>`
  const r = data.report
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

      <div className="mt-3 flex items-center gap-3">
        <span aria-hidden className="text-2xl" style={{ color: 'rgb(var(--ts-accent))' }}>✓</span>
        <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: 'rgb(var(--ts-text-1))' }}>{data.domain}</h1>
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
                    {b.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
            </>
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
          <span aria-hidden style={{ color: 'rgb(var(--ts-accent))' }}>✓</span>
          {x('seal.ownershipVerifiedShort')} · <strong>TrustSeal</strong>
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
