// app/trustseal/[locale]/pricing/page.tsx  (asq-trustseal-harden)
// Real, indexable pricing page (canonical + en/hi/es/ar hreflang via buildTrustMeta).
import type { Metadata } from 'next'
import { PricingView } from '@/components/trustseal/home/pricing-view'
import { buildTrustMeta } from '@/lib/trustseal/seo'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  return buildTrustMeta({ locale: lc, subpath: '/pricing', title: `${t(lc, 'pricingPage.title')} — ${t(lc, 'common.product')}`, description: t(lc, 'pricingPage.subtitle'), index: true })
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  return <PricingView locale={lc} />
}
