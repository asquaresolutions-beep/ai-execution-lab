// app/trustseal/[locale]/page.tsx  (asq-trustseal-public-launch)
// Public TrustSeal homepage. Server component → locale-aware, INDEXABLE metadata
// (canonical + en/hi/es/ar hreflang + x-default + OG locale via buildTrustMeta),
// rendering the i18n landing page. SSG-neutral: locale from static params, no
// dynamic request reads.
import type { Metadata } from 'next'
import { TrustSealLanding } from '@/components/trustseal/home/landing'
import { buildTrustMeta } from '@/lib/trustseal/seo'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  return buildTrustMeta({
    locale: lc,
    subpath: '',
    title: `${t(lc, 'common.product')} — ${t(lc, 'common.tagline')}`,
    description: t(lc, 'hero.subtitle'),
    index: true, // public landing page is indexable (hreflang + canonical included)
  })
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  return <TrustSealLanding locale={lc} />
}
