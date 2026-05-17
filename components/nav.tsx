'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, SECTION_META } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/docs',          label: 'Docs' },
  { href: '/systems',       label: 'Systems' },
  { href: '/labs',          label: 'Labs' },
  { href: '/case-studies',  label: 'Case Studies' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-500 text-white text-xs font-black group-hover:bg-brand-600 transition-colors">
              AI
            </span>
            <span className="font-semibold text-surface-100 text-sm tracking-tight">
              Execution Lab
            </span>
            <span className="hidden sm:inline-block text-surface-500 text-xs">
              by A Square Solutions
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    active
                      ? 'bg-surface-800 text-surface-100'
                      : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* External link */}
          <a
            href="https://asquaresolution.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-xs text-surface-500 hover:text-brand-400 transition-colors"
          >
            asquaresolution.com
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  )
}
