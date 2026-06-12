// app/trustseal/[locale]/trust/[domain]/page.tsx  (asq-trustseal-pr4)
// Public seal/trust page: /{locale}/trust/{domain} (host-rewritten from the
// trustseal public host). Renders ONLY for domains with a verified ownership
// claim; everything else 404s (and stays noindex). No auth, no SSRF — getSealData
// does read-only Firestore lookups by doc id. ISR-cached (revalidate) per the
// approved caching strategy; the [domain] param is on-demand so nothing is
// mass-prerendered (the static page count is unchanged).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSealData } from '@/lib/trustseal/seal'
import { SealView } from '@/components/trustseal/seal-view'
import { buildTrustMeta } from '@/lib/trustseal/seo'

// On-demand dynamic params (domains are an open set) + ISR cache (2h, matching
// the clean-verdict TTL). dynamicParams=true overrides the parent [locale] layout
// (which only restricts the locale segment).
export const dynamicParams = true
export const revalidate = 7200
export function generateStaticParams(): { domain: string }[] {
  return [] // prerender none — every domain renders on demand and is ISR-cached
}

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
  return <SealView data={data} locale={locale} />
}
