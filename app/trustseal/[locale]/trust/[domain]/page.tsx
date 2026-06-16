// app/trustseal/[locale]/trust/[domain]/page.tsx  (asq-trustseal-pr4)
// Public seal/trust page: /{locale}/trust/{domain} (host-rewritten from the
// trustseal public host). Renders ONLY for domains with a verified ownership
// claim; everything else 404s (and stays noindex). No auth, no SSRF — getSealData
// does read-only Firestore lookups by doc id. Rendered fully dynamic (no ISR) so a
// newly-verified domain reflects immediately and a not-found is never cached.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSealData, getSealTimeline } from '@/lib/trustseal/seal'
import { SealView } from '@/components/trustseal/seal-view'
import { buildTrustMeta } from '@/lib/trustseal/seo'

// Fully dynamic: render per request so verification status is ALWAYS fresh and a
// not-found (unverified) result is NEVER ISR-cached — this removes the stale-404
// failure mode where a domain verified after a cache render stayed 404. Reads are
// cheap doc-id lookups; the high-traffic badge path uses the CDN-cached status API.
// dynamicParams=true keeps the open [domain] set on demand.
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export async function generateMetadata({ params }: { params: Promise<{ locale: string; domain: string }> }): Promise<Metadata> {
  const { locale, domain } = await params
  const data = await getSealData(decodeURIComponent(domain))
  if (!data) {
    // Unverified/unknown → noindex (page 404s anyway).
    return buildTrustMeta({ locale, subpath: `/trust/${domain}`, title: 'TrustSeal', description: 'Domain trust verification.', index: false })
  }
  const summary = data.report ? ` Trust band: ${data.report.band} (score ${data.report.score}/100).` : ''
  return buildTrustMeta({
    locale,
    subpath: `/trust/${data.domain}`,
    title: `${data.domain} — Verified by TrustSeal`,
    description: `${data.domain} has verified domain ownership with TrustSeal.${summary}`,
    index: true,
  })
}

export default async function Page({ params }: { params: Promise<{ locale: string; domain: string }> }) {
  const { locale, domain } = await params
  const data = await getSealData(decodeURIComponent(domain))
  if (!data) notFound()
  const timeline = await getSealTimeline(data.domain)
  return <SealView data={data} locale={locale} timeline={timeline} />
}
