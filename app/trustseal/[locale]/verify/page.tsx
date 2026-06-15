// app/trustseal/[locale]/verify/page.tsx  (asq-trustseal-harden)
// Real, indexable verify page. Server shell → locale-aware metadata; the lookup
// form is a client child (VerifyView).
import type { Metadata } from 'next'
import { VerifyView } from '@/components/trustseal/home/verify-view'
import { buildTrustMeta } from '@/lib/trustseal/seo'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  return buildTrustMeta({ locale: lc, subpath: '/verify', title: `${t(lc, 'verify.title')} — ${t(lc, 'common.product')}`, description: t(lc, 'verify.subtitle'), index: true })
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  return <VerifyView locale={lc} />
}
