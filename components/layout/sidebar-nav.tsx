'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Nav structure
// ─────────────────────────────────────────────────────────────

const NAV = [
  {
    group: null,
    items: [{ href: '/', label: 'Dashboard', exact: true }],
  },
  {
    group: 'Knowledge',
    items: [
      { href: '/docs',    label: 'Docs'     },
      { href: '/systems', label: 'Systems'  },
    ],
  },
  {
    group: 'Research',
    items: [
      { href: '/labs',         label: 'Labs'            },
      { href: '/case-studies', label: 'Case Studies'    },
      { href: '/failures',     label: 'Failure Archive' },
      { href: '/logs',         label: 'Execution Logs'  },
    ],
  },
  {
    group: 'Execution',
    items: [
      { href: '/playbooks', label: 'Playbooks' },
      { href: '/tracks',    label: 'Tracks'    },
    ],
  },
  {
    group: 'Discover',
    items: [
      { href: '/tags',      label: 'Topics'       },
    ],
  },
  {
    group: 'Publish',
    items: [
      { href: '/syndicate', label: 'Syndication' },
    ],
  },
  {
    group: 'Ops',
    items: [
      { href: '/ops', label: 'Operations' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Single nav item
// ─────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  exact = false,
}: {
  href: string
  label: string
  exact?: boolean
}) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded px-3 py-1.5 text-sm transition-colors relative',
        isActive
          ? 'nav-active font-medium'
          : 'text-surface-400 hover:text-surface-200 hover:bg-white/[0.04]'
      )}
    >
      {label}
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// Full sidebar nav
// ─────────────────────────────────────────────────────────────

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 px-2 py-3 space-y-5" onClick={onNavigate}>
      {NAV.map((section, i) => (
        <div key={i}>
          {section.group && (
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-surface-600">
              {section.group}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
