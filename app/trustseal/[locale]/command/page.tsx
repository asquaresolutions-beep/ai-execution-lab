// app/trustseal/[locale]/command/page.tsx  (asq-trustseal-command-phase1)
// Trust Intelligence Command Center — Phase-1 VISUAL prototype (mock data).
// Server component keeps the route noindex (internal ops surface) + SSG-neutral;
// the interactive command center is a client child. Owner-scoped auth gating and
// real data wiring land in the next phase (this prototype renders mock data so it
// can be reviewed/screenshotted).
import type { Metadata } from 'next'
import { CommandCenter } from '@/components/trustseal/command/command-center'
import { buildTrustMeta } from '@/lib/trustseal/seo'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  // index:false (default) — ops surface, never indexed.
  return buildTrustMeta({ locale, subpath: '/command', title: 'TrustSeal — Command Center', description: 'Trust Intelligence Command Center.' })
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <CommandCenter locale={locale} />
}
