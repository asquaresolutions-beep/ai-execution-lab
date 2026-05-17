import Link from 'next/link'
import { SidebarNav } from './sidebar-nav'
import { SearchTrigger } from '@/components/search/search-trigger'

// ─────────────────────────────────────────────────────────────
// Sidebar — server component, desktop only (hidden on mobile)
// ─────────────────────────────────────────────────────────────

export function Sidebar() {
  return (
    <aside
      className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-white/[0.06]"
      style={{ backgroundColor: 'rgb(9,14,26)' }}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <Link href="/" className="block group">
          <span className="block text-sm font-bold text-surface-100 tracking-tight group-hover:text-white transition-colors">
            AI Execution Lab
          </span>
          <span className="block mt-0.5 text-[11px] font-medium text-brand-500/80 font-mono tracking-wide">
            A Square Solutions
          </span>
        </Link>
      </div>

      {/* Search trigger */}
      <div className="px-3 pt-3 pb-1">
        <SearchTrigger />
      </div>

      {/* Navigation */}
      <SidebarNav />

      {/* Footer */}
      <div className="mt-auto px-4 py-4 border-t border-white/[0.06] space-y-2">
        <div>
          <a
            href="https://asquaresolution.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-surface-600 hover:text-surface-400 transition-colors font-mono"
          >
            asquaresolution.com ↗
          </a>
          <p className="mt-0.5 text-[10px] text-surface-700">
            A Square Solutions · Engineering Journal
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="https://trustseal.asquaresolution.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-surface-700 hover:text-surface-500 transition-colors"
            title="TrustSeal — AI trust verification"
          >
            TrustSeal ↗
          </a>
          <a
            href="https://scamcheck.asquaresolution.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-surface-700 hover:text-surface-500 transition-colors"
            title="ScamCheck — AI scam detection"
          >
            ScamCheck ↗
          </a>
        </div>
      </div>
    </aside>
  )
}
