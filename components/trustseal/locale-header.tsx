'use client'
// components/trustseal/locale-header.tsx  (asq-trustseal-command-phase2)
// The TrustSeal marketing/locale header (product name + locale switcher).
// Rendered by the [locale] layout on every TrustSeal page EXCEPT the Command
// Center, which is a dedicated immersive surface that owns the whole viewport
// and provides its own navigation. usePathname() resolves during SSR for client
// components, so the static HTML is correct on /command (header omitted) with no
// hydration flash. `product` is pre-resolved server-side and passed in, keeping
// this component free of the messages/i18n dependency.
import { usePathname } from 'next/navigation'
import type { Locale } from '@/lib/trustseal/locales'
import { LocaleSwitcher } from '@/components/trustseal/locale-switcher'

export function TrustSealLocaleHeader({ locale, product }: { locale: Locale; product: string }) {
  const pathname = usePathname()
  if (/(?:^|\/)command\/?$/.test(pathname || '')) return null
  return (
    <header className="border-b" style={{ borderColor: 'rgb(var(--ts-border))' }}>
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>
          {product}
        </span>
        <LocaleSwitcher current={locale} />
      </div>
    </header>
  )
}
