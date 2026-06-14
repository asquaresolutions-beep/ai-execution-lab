'use client'

// Picks the chrome by route: ScamCheck product chrome on ScamCheck routes,
// AI Execution Lab chrome everywhere else.
//
// The lab chrome (Sidebar/TopBar/EcosystemFooter) and the Cmd+K SearchModal are
// imported lazily here rather than passed as props from the server layout. If
// they were rendered in the server layout (even as unused props), the server
// would serialize their markup — including lab route names — into the RSC
// payload of EVERY page, leaking lab branding into the ScamCheck product domain.
// Lazy-importing them inside the lab-only branch keeps them out of the ScamCheck
// payload entirely, while the lab site still renders them. Pages stay static.
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useSelectedLayoutSegment, usePathname } from 'next/navigation'
import { ScamCheckNav } from '@/components/scamcheck/scamcheck-nav'
import { ScamCheckFooter } from '@/components/scamcheck/scamcheck-footer'

const Sidebar = dynamic(() => import('@/components/layout/sidebar').then((m) => m.Sidebar))
const TopBar = dynamic(() => import('@/components/layout/top-bar').then((m) => m.TopBar))
const EcosystemFooter = dynamic(() => import('@/components/platform/ecosystem-footer').then((m) => m.EcosystemFooter))
const SearchModal = dynamic(() => import('@/components/search/search-modal').then((m) => m.SearchModal))

// Top-level route segments that belong to the ScamCheck product. We key off the
// *rendered* segment (useSelectedLayoutSegment) rather than the URL, so the
// homepage rewrite ("/" → /scamcheck) resolves to segment "scamcheck" and gets
// product chrome, while the lab homepage (segment === null) keeps lab chrome.
const SC_SEGMENTS = new Set([
  'scamcheck', 'scam-intelligence', 'scam-database', 'latest-scams', 'es', 'hi',
  'about', 'how-it-works', 'methodology', 'contact', 'privacy-policy', 'terms', 'disclaimer',
])
function isScamCheckSegment(seg: string | null): boolean {
  if (!seg) return false
  if (seg.endsWith('-scam-checker')) return true
  return SC_SEGMENTS.has(seg)
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const seg = useSelectedLayoutSegment()
  const pathname = usePathname()
  // The TrustSeal Command Center is a dedicated immersive surface — it owns the
  // whole viewport and provides its own single navigation. Suppress ALL global
  // chrome (lab Sidebar/TopBar/Footer + the TrustSeal locale header gate) on it.
  // usePathname() is resolved during SSR for client components, so the static
  // HTML is correct and there is no hydration flash. Matches /{locale}/command
  // under both the internal /trustseal/* path and the host-rewritten public URL.
  if (/(?:^|\/)command\/?$/.test(pathname || '')) {
    return <>{children}</>
  }
  if (isScamCheckSegment(seg)) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950">
        <ScamCheckNav />
        <main className="flex-1">{children}</main>
        <ScamCheckFooter />
      </div>
    )
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1">{children}</main>
        <EcosystemFooter />
      </div>
      {/* Cmd+K palette indexes lab routes → lab chrome only. */}
      <SearchModal />
    </div>
  )
}
