// app/trustseal/[locale]/docs/page.tsx  (asq-trustseal-harden)
// Real, indexable, fully-localized Documentation Center (replaces the placeholder).
import type { Metadata } from 'next'
import { ContentPageView } from '@/components/trustseal/content-page'
import { docsContent } from '@/lib/trustseal/content/docs'
import { buildTrustMeta } from '@/lib/trustseal/seo'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const p = docsContent[lc]
  return buildTrustMeta({ locale: lc, subpath: '/docs', title: `${p.title} — TrustSeal`, description: p.subtitle, index: true })
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  return <ContentPageView locale={lc} page={docsContent[lc]} toc />
}
