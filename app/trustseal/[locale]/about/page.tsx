// app/trustseal/[locale]/about/page.tsx  (asq-trustseal-a1)
// Phase-A placeholder. English only, no animation, noindex until real content (Phase C).
import type { Metadata } from 'next'
import { TrustSealPlaceholder } from '@/components/trustseal/placeholder'

export const metadata: Metadata = { title: 'TrustSeal — About', robots: { index: false, follow: false } }

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <TrustSealPlaceholder locale={locale} title="About TrustSeal" subtitle="Company, methodology and team. (About placeholder.)" />
}
