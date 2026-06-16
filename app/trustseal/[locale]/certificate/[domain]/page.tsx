// app/trustseal/[locale]/certificate/[domain]/page.tsx  (asq-trustseal-phase3)
// Verification certificate for a verified domain. Dynamic (fresh status; a
// not-found is never cached) and noindex (the public seal page is the indexable
// canonical; the certificate is a downloadable artifact, not an SEO surface).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSealData } from '@/lib/trustseal/seal'
import { buildCertificate } from '@/lib/trustseal/certificate'
import { CertificateView } from '@/components/trustseal/certificate/certificate-view'
import { buildTrustMeta } from '@/lib/trustseal/seo'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'

export const dynamic = 'force-dynamic'
export const dynamicParams = true

export async function generateMetadata({ params }: { params: Promise<{ locale: string; domain: string }> }): Promise<Metadata> {
  const { locale, domain } = await params
  // noindex (index defaults to false in buildTrustMeta) — artifact, not a landing page.
  return buildTrustMeta({ locale, subpath: `/certificate/${domain}`, title: `Certificate — ${decodeURIComponent(domain)} — TrustSeal`, description: 'TrustSeal verification certificate.' })
}

export default async function Page({ params }: { params: Promise<{ locale: string; domain: string }> }) {
  const { locale, domain } = await params
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const data = await getSealData(decodeURIComponent(domain))
  if (!data) notFound()
  return <CertificateView locale={lc} cert={buildCertificate(data)} />
}
