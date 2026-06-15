// app/trustseal/[locale]/legal/[doc]/page.tsx  (asq-trustseal-harden-legal)
// Legal center: /{locale}/legal/{doc} for each policy. Indexable, locale-aware
// metadata; bodies English (controlling language), chrome localized.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LegalView } from '@/components/trustseal/legal/legal-view'
import { LEGAL_DOCS, LEGAL_SLUGS, type LegalSlug } from '@/lib/trustseal/legal-content'
import { buildTrustMeta } from '@/lib/trustseal/seo'
import { LOCALES, isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'

export const dynamicParams = false

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => LEGAL_SLUGS.map((doc) => ({ locale, doc })))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; doc: string }> }): Promise<Metadata> {
  const { locale, doc } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const d = LEGAL_DOCS[doc as LegalSlug]
  if (!d) return buildTrustMeta({ locale: lc, subpath: `/legal/${doc}`, title: 'TrustSeal', description: 'TrustSeal legal.', index: false })
  return buildTrustMeta({ locale: lc, subpath: `/legal/${doc}`, title: `${d.title} — TrustSeal`, description: d.description, index: true })
}

export default async function Page({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const d = LEGAL_DOCS[doc as LegalSlug]
  if (!d) notFound()
  return <LegalView locale={lc} doc={d} />
}
