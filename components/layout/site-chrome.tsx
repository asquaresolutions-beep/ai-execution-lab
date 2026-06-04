'use client'

// Picks the chrome by route: ScamCheck product chrome on ScamCheck routes,
// AI Execution Lab chrome (passed in as props from the server layout)
// everywhere else. Client component → keeps pages statically rendered (no
// headers()/dynamic), and server lab chrome is passed through as props.
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ScamCheckNav } from '@/components/scamcheck/scamcheck-nav'
import { ScamCheckFooter } from '@/components/scamcheck/scamcheck-footer'
import { SearchModal } from '@/components/search/search-modal'

const SC_PREFIXES = ['/scamcheck', '/scam-intelligence', '/scam-database', '/latest-scams']
const SC_EXACT = new Set(['/privacy-policy', '/terms', '/contact', '/about', '/how-it-works', '/methodology'])
function isScamCheckRoute(path: string): boolean {
  if (SC_EXACT.has(path)) return true
  if (path.endsWith('-scam-checker')) return true
  return SC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
}

export function SiteChrome({ children, labSidebar, labTopBar, labFooter }: { children: ReactNode; labSidebar: ReactNode; labTopBar: ReactNode; labFooter: ReactNode }) {
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
      {labSidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {labTopBar}
        <main className="flex-1">{children}</main>
        {labFooter}
      </div>
      {/* Cmd+K palette indexes lab routes → lab chrome only (kept off the ScamCheck product domain). */}
      <SearchModal />
    </div>
  )
}
