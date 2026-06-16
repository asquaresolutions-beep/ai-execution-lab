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
  const product = [
    { href: L('/pricing'), label: x('nav.pricing') },
    { href: L('/verify'), label: x('nav.verify') },
    { href: L('/trust-center'), label: x('nav.trustCenter') },
    { href: L('/security'), label: x('nav.security') },
    { href: L('/docs'), label: x('nav.docs') },
    { href: L('/about'), label: x('nav.about') },
  ]
  const legal = [
    { href: L('/legal/privacy'), label: x('legal.privacy') },
    { href: L('/legal/terms'), label: x('legal.terms') },
    { href: L('/legal/security'), label: x('legal.security') },
    { href: L('/legal/trademark-policy'), label: x('legal.trademark') },
    { href: L('/legal/dmca'), label: x('legal.dmca') },
    { href: L('/docs'), label: x('nav.docs') },
  ]
  const linkStyle = { color: 'rgb(var(--ts-text-2))' } as const
  return (
    <footer className="mt-16 border-t" style={{ borderColor: 'rgb(var(--ts-border))' }}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* primary — product */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href={L('')} className="text-sm font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('common.product')}</a>
          {product.map((l) => <a key={l.href} href={l.href} className="text-sm" style={linkStyle}>{l.label}</a>)}
        </div>
        {/* legal + contact */}
        <nav aria-label={x('legal.policies')} className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {legal.map((l) => <a key={l.href + l.label} href={l.href} style={linkStyle}>{l.label}</a>)}
          <a href="mailto:contact@asquaresolution.com" style={linkStyle}>{x('footer.contact')}</a>
        </nav>
        {/* secondary — small ecosystem reference only */}
        <div className="mt-6 border-t pt-6 text-xs" style={{ borderColor: 'rgb(var(--ts-border))', color: 'rgb(var(--ts-text-3))' }}>
          <p>{x('footer.builtBy')}</p>
          <p className="mt-1">{x('common.copyright')}</p>
        </div>
      </div>
    </footer>
  )
}
