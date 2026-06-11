// app/trustseal/[locale]/dashboard/page.tsx  (asq-trustseal-a1)
// Phase-A placeholder. English only, no animation, noindex until real content (Phase C).
import type { Metadata } from 'next'
import { TrustSealPlaceholder } from '@/components/trustseal/placeholder'

export const metadata: Metadata = { title: 'TrustSeal — Dashboard', robots: { index: false, follow: false } }

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <TrustSealPlaceholder locale={locale} title="Dashboard" subtitle="Monitoring, alerts and account. (Dashboard placeholder — auth lands in Phase D.)" />
}
