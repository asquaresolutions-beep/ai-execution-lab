// app/trustseal/[locale]/dashboard/page.tsx  (asq-trustseal-a1; auth shell pr1)
// Customer dashboard. The page stays a SERVER component so locale-aware metadata
// (noindex via buildTrustMeta default) + SSG are preserved; the interactive,
// authenticated shell is a CLIENT child (DashboardClient) so the parent static
// [locale] layout (dynamicParams=false, no dynamic reads) is unaffected.
import type { Metadata } from 'next'
import { DashboardClient } from '@/components/trustseal/dashboard-client'
import { buildTrustMeta } from '@/lib/trustseal/seo'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return buildTrustMeta({ locale, subpath: '/dashboard', title: 'TrustSeal — Dashboard', description: 'Manage your verified domains, badge and billing.' })
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <DashboardClient locale={locale} />
}
