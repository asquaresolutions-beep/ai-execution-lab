// app/trustseal/[locale]/trust-center/page.tsx  (asq-trustseal-phase3)
// Trust Center — the indexable authority hub (methodology, standards, framework,
// signal library). Fully localized; built on the shared ContentPageView.
import type { Metadata } from 'next'
import { ContentPageView } from '@/components/trustseal/content-page'
import { trustCenterContent } from '@/lib/trustseal/content/trust-center'
import { buildTrustMeta } from '@/lib/trustseal/seo'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const p = trustCenterContent[lc]
  return buildTrustMeta({ locale: lc, subpath: '/trust-center', title: `${p.title} — TrustSeal`, description: p.subtitle, index: true })
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  return <ContentPageView locale={lc} page={trustCenterContent[lc]} toc />
}
