// app/trustseal/[locale]/security/page.tsx  (asq-trustseal-harden)
// Real, indexable, fully-localized Security Center (replaces the placeholder).
import type { Metadata } from 'next'
import { ContentPageView } from '@/components/trustseal/content-page'
import { securityContent } from '@/lib/trustseal/content/security'
import { buildTrustMeta } from '@/lib/trustseal/seo'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const p = securityContent[lc]
  return buildTrustMeta({ locale: lc, subpath: '/security', title: `${p.title} — TrustSeal`, description: p.subtitle, index: true })
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  return <ContentPageView locale={lc} page={securityContent[lc]} toc />
}
