// app/trustseal/[locale]/about/page.tsx  (asq-trustseal-a1; locale-aware meta a4)
// Phase-A placeholder. English only, no animation. buildTrustMeta keeps it noindex
// (index defaults to false) with full hreflang until real content lands (Phase C).
import type { Metadata } from 'next'
import { TrustSealPlaceholder } from '@/components/trustseal/placeholder'
import { buildTrustMeta } from '@/lib/trustseal/seo'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return buildTrustMeta({ locale, subpath: '/about', title: 'TrustSeal — About', description: 'About TrustSeal: company, methodology and team.' })
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <TrustSealPlaceholder locale={locale} title="About TrustSeal" subtitle="Company, methodology and team. (About placeholder.)" />
}
