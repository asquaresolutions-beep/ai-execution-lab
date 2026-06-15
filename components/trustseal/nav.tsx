'use client'
// components/trustseal/nav.tsx  (asq-trustseal-standalone)
// Standalone TrustSeal top navigation (replaces the AI Execution Lab chrome).
// Logo + product links + locale switcher + auth-aware Sign in / Dashboard, with a
// responsive mobile menu. Hidden on /command (immersive). Auth-aware via its own
// AuthProvider so it works in the layout (outside the dashboard's provider).
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { AuthProvider, useAuth } from '@/components/auth/auth-provider'
import { LocaleSwitcher } from '@/components/trustseal/locale-switcher'
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

function HexMark() {
  return (
    <svg viewBox="0 0 40 40" width={22} height={22} aria-hidden>
      <defs><linearGradient id="nav-tsmark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
      <polygon points="20,3 34,11 34,29 20,37 6,29 6,11" fill="none" stroke="url(#nav-tsmark)" strokeWidth="2.4" />
      <path d="M14 20 l4 4 l8 -9" fill="none" stroke="url(#nav-tsmark)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NavInner({ locale }: { locale: Locale }) {
  const x = (k: string) => t(locale, k)
  const L = (s: string) => `/${locale}${s}`
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const links = [
    { href: L('/verify'), label: x('nav.verify') },
    { href: L('/pricing'), label: x('nav.pricing') },
    { href: L('/security'), label: x('nav.security') },
    { href: L('/docs'), label: x('nav.docs') },
    { href: L('/about'), label: x('nav.about') },
  ]
  return (
    <header className="sticky top-0 z-30 border-b" style={{ borderColor: 'rgb(var(--ts-border))', background: 'rgb(var(--ts-bg))' }}>
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <a href={L('')} className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>
          <HexMark />{x('common.product')}
        </a>
        <nav className="ms-6 hidden items-center gap-5 md:flex" aria-label={x('common.product')}>
          {links.map((l) => <a key={l.href} href={l.href} className="text-sm hover:opacity-80" style={{ color: 'rgb(var(--ts-text-2))' }}>{l.label}</a>)}
        </nav>
        <div className="ms-auto flex items-center gap-3">
          <LocaleSwitcher current={locale} />
          <a href={L('/dashboard')}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold"
            style={user
              ? { background: 'rgb(var(--ts-accent))', color: '#06121e' }
              : { border: '1px solid rgb(var(--ts-border))', color: 'rgb(var(--ts-text-1))' }}>
            {user ? x('nav.dashboard') : x('nav.signIn')}
          </a>
          <button type="button" aria-label={x('nav.menu')} aria-expanded={open} onClick={() => setOpen((o) => !o)}
            className="md:hidden" style={{ color: 'rgb(var(--ts-text-1))' }}>☰</button>
        </div>
      </div>
      {open && (
        <nav className="border-t px-6 py-2 md:hidden" style={{ borderColor: 'rgb(var(--ts-border))' }} aria-label={x('nav.menu')}>
          {links.map((l) => <a key={l.href} href={l.href} className="block py-2 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>{l.label}</a>)}
        </nav>
      )}
    </header>
  )
}

export function TrustSealNav({ locale }: { locale: Locale }) {
  const pathname = usePathname()
  if (/(?:^|\/)command\/?$/.test(pathname || '')) return null // immersive Command Center
  return (
    <AuthProvider>
      <NavInner locale={locale} />
    </AuthProvider>
  )
}
