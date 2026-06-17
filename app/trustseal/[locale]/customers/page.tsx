// app/trustseal/[locale]/customers/page.tsx  (asq-trustseal-conversion)
// Real Customers page (replaces the placeholder): live verified-domain social proof
// + use cases + testimonials framework. Indexable; ISR (hourly) so the verified
// list stays current. Fail-safe: store error → empty list (page still renders).
import type { Metadata } from 'next'
import { CustomersView } from '@/components/trustseal/home/customers-view'
import { getRecentVerifications } from '@/lib/trustseal/home-data'
import { customersContent } from '@/lib/trustseal/content/customers'
import { buildTrustMeta } from '@/lib/trustseal/seo'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'

export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const c = customersContent[lc]
  return buildTrustMeta({ locale: lc, subpath: '/customers', title: `${c.title} — TrustSeal`, description: c.subtitle, index: true })
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const verified = await getRecentVerifications(24)
  return <CustomersView locale={lc} verified={verified} />
}
