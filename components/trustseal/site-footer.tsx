'use client'
// components/trustseal/site-footer.tsx  (asq-trustseal-standalone)
// Standalone TrustSeal footer for all public/auth pages (replaces the lab
// EcosystemFooter as primary nav). Primary: product links. Secondary: a small
// "Built by A Square Solutions" line + copyright. Hidden on /command (immersive).
import { usePathname } from 'next/navigation'
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

export function TrustSealFooter({ locale }: { locale: Locale }) {
  const pathname = usePathname()
  if (/(?:^|\/)command\/?$/.test(pathname || '')) return null
  const x = (k: string) => t(locale, k)
  const L = (s: string) => `/${locale}${s}`
  const links = [
    { href: L('/pricing'), label: x('nav.pricing') },
    { href: L('/verify'), label: x('nav.verify') },
    { href: L('/security'), label: x('nav.security') },
    { href: L('/docs'), label: x('nav.docs') },
    { href: L('/about'), label: x('nav.about') },
  ]
  return (
    <footer className="mt-16 border-t" style={{ borderColor: 'rgb(var(--ts-border))' }}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* primary */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href={L('')} className="text-sm font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('common.product')}</a>
          {links.map((l) => <a key={l.href} href={l.href} className="text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>{l.label}</a>)}
        </div>
        {/* secondary — small ecosystem reference only */}
        <div className="mt-6 border-t pt-6 text-xs" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-3))' }}>
          <p>{x('footer.builtBy')}</p>
          <p className="mt-1">{x('common.copyright')}</p>
        </div>
      </div>
    </footer>
  )
}
