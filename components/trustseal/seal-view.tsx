// components/trustseal/seal-view.tsx  (asq-trustseal-pr4)
// Public seal/trust page presentation. SERVER component (no client JS) so the
// verdict content is server-rendered for SEO. Renders only the public projection.
import Link from 'next/link'
import type { SealData } from '@/lib/trustseal/seal'

const TRUST_BASE = (process.env.TRUSTSEAL_BASE_URL || 'https://trustseal.asquaresolution.com').replace(/\/$/, '')

const card = { borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-surface-2))' } as const
const fmt = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : '—')

const BAND_LABEL: Record<string, string> = {
  verified: 'Verified', established: 'Established', limited: 'Limited',
  caution: 'Caution', high_risk: 'High risk',
}

export function SealView({ data, locale }: { data: SealData; locale: string }) {
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
        Domain ownership verified by TrustSeal
      </p>

      {/* Verification facts */}
      <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border sm:grid-cols-2" style={{ borderColor: 'rgb(var(--ts-border))' }}>
        <Fact label="TrustSeal status" value={r ? `${BAND_LABEL[r.band] ?? r.band}` : 'Ownership verified'} accent />
        <Fact label="Verification method" value={data.method.toUpperCase()} />
        <Fact label="Verified on" value={fmt(data.verifiedAt)} />
        <Fact label="Last checked" value={fmt(data.lastCheckedAt)} />
      </dl>

      {/* Business / domain summary (if a verdict exists) */}
      {r ? (
        <section className="mt-6 rounded-xl border p-5" style={card}>
          <h2 className="text-base font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>Trust summary</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>
            Trust score <strong style={{ color: 'rgb(var(--ts-text-1))' }}>{r.score}/100</strong> · confidence {(r.confidence * 100).toFixed(0)}%
            {r.partial ? ' · partial coverage' : ''}
          </p>
          {r.badges?.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {r.badges.map((b) => (
                <li key={b} className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-2))' }}>
                  {b.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="mt-6 rounded-xl border p-5" style={card}>
          <p className="text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>
            Ownership is verified. A full trust report for this domain is being prepared.
          </p>
        </section>
      )}

      <footer className="mt-8 text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>
        Verification by <Link href={`/${locale}`} className="hover:underline" style={{ color: 'rgb(var(--ts-accent))' }}>TrustSeal</Link> · public record.
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
