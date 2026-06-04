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
import { usePathname } from 'next/navigation'
import { ScamCheckNav } from '@/components/scamcheck/scamcheck-nav'
import { ScamCheckFooter } from '@/components/scamcheck/scamcheck-footer'

const Sidebar = dynamic(() => import('@/components/layout/sidebar').then((m) => m.Sidebar))
const TopBar = dynamic(() => import('@/components/layout/top-bar').then((m) => m.TopBar))
const EcosystemFooter = dynamic(() => import('@/components/platform/ecosystem-footer').then((m) => m.EcosystemFooter))
const SearchModal = dynamic(() => import('@/components/search/search-modal').then((m) => m.SearchModal))

const SC_PREFIXES = ['/scamcheck', '/scam-intelligence', '/scam-database', '/latest-scams']
const SC_EXACT = new Set(['/privacy-policy', '/terms', '/contact', '/about', '/how-it-works', '/methodology'])
function isScamCheckRoute(path: string): boolean {
  if (SC_EXACT.has(path)) return true
  if (path.endsWith('-scam-checker')) return true
  return SC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const path = usePathname() || '/'
  if (isScamCheckRoute(path)) {
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
