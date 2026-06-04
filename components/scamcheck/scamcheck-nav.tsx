'use client'

// ScamCheck product navigation — replaces AI Execution Lab chrome on ScamCheck
// routes. Clickable logo → /scamcheck. Mobile hamburger; active-link highlight.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'

const NAV: { label: string; href: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'Quick Scan', href: '/' },
  { label: 'Screenshot Scanner', href: '/scamcheck/screenshot' },
  { label: 'Link Checker', href: '/link-scam-checker' },
  { label: 'Email Checker', href: '/email-scam-checker' },
  { label: 'Phone Checker', href: '/phone-scam-checker' },
  { label: 'Latest Scams', href: '/latest-scams' },
  { label: 'Trending Scams', href: '/scam-intelligence' },
  { label: 'Scam Guides', href: '/scam-database' },
  { label: 'Report a Scam', href: '/contact' },
  { label: 'My Dashboard', href: '/scamcheck/account' },
]

export function ScamCheckNav() {
  const path = usePathname() || '/'
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label="ScamCheck home">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500 text-sm font-bold text-white">S</span>
          <span className="font-semibold text-zinc-100">ScamCheck</span>
          <span className="hidden text-[10px] text-zinc-500 sm:inline">by A Square Solutions</span>
        </Link>
        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.filter((n) => n.label !== 'Home' && n.label !== 'Quick Scan' || n.label === 'Home').map((n) => (
            <Link key={n.label} href={n.href} className={cn('rounded-md px-2.5 py-1.5 text-xs', path === n.href ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100')}>{n.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:flex" />
          <button onClick={() => setOpen((o) => !o)} className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 lg:hidden" aria-label="Menu">☰</button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-zinc-800 bg-zinc-950 px-4 py-2 lg:hidden">
          <ul className="grid grid-cols-2 gap-1">
            {NAV.filter((n, i) => NAV.findIndex((x) => x.href === n.href) === i).map((n) => (
              <li key={n.label}><Link href={n.href} onClick={() => setOpen(false)} className={cn('block rounded-md px-2 py-1.5 text-sm', path === n.href ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300')}>{n.label}</Link></li>
            ))}
          </ul>
          <div className="mt-2 border-t border-zinc-800 pt-2"><LanguageSwitcher /></div>
        </nav>
      )}
    </header>
  )
}
