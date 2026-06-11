'use client'
// components/trustseal/locale-switcher.tsx  (asq-trustseal-a2)
// Manual locale switcher. Renders <Link>s to the same page in each locale and
// persists the choice to the NEXT_LOCALE cookie on click. NO automatic
// navigation (no effects that redirect), NO host logic — navigation happens only
// when the user clicks a link. Uses scoped --ts-* tokens.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LOCALES, LOCALE_LABEL, type Locale } from '@/lib/trustseal/locales'
import { localizePath } from '@/lib/trustseal/navigation'
import { writeLocaleCookie } from '@/lib/trustseal/cookie'

export function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname() || ''
  return (
    <nav aria-label="Language" className="flex items-center gap-1 text-xs">
      {LOCALES.map((loc) => {
        const active = loc === current
        return (
          <Link
            key={loc}
            href={localizePath(pathname, loc)}
            hrefLang={loc}
            lang={loc}
            aria-current={active ? 'true' : undefined}
            onClick={() => writeLocaleCookie(loc)}
            className="rounded px-2 py-1 transition-colors"
            style={{
              color: active ? 'rgb(var(--ts-accent))' : 'rgb(var(--ts-text-2))',
              backgroundColor: active ? 'rgb(var(--ts-surface-2))' : 'transparent',
            }}
          >
            {LOCALE_LABEL[loc]}
          </Link>
        )
      })}
    </nav>
  )
}
