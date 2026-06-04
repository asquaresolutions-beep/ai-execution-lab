'use client'

// components/i18n/language-switcher.tsx
// Locale selector for ScamCheck. Page content is rendered per-route (English at
// the root, full Spanish at /es), so switching language NAVIGATES to the
// localized URL rather than trying to swap text in place (which previously did
// nothing — the selector changed state but no content was bound to it).
//
// Languages offered here are the ones with real translated pages: English +
// Español. The screenshot scanner additionally supports Hindi via its own
// in-component control; dedicated Hindi pages don't exist yet.

import { usePathname, useRouter } from 'next/navigation'
import { ES_CHECKERS } from '@/lib/scamcheck/es-pages'

type Loc = 'en' | 'es'
const OPTIONS: { code: Loc; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
]

/** Current locale from the path. */
function localeOf(path: string): Loc {
  return path === '/es' || path.startsWith('/es/') ? 'es' : 'en'
}

/** Map the current path to its equivalent in the target locale. */
export function localizedPath(path: string, target: Loc): string {
  // Normalise to the English equivalent first.
  let en = path
  if (path === '/es') en = '/'
  else if (path.startsWith('/es/')) {
    const esSlug = path.slice('/es/'.length)
    const m = ES_CHECKERS.find((c) => c.slug === esSlug)
    en = m ? `/${m.enSlug}` : '/'
  }
  if (target === 'en') return en
  // Target Spanish: map known English checker slugs → /es/<slug>, else /es home.
  if (en === '/') return '/es'
  const slug = en.replace(/^\//, '')
  const m = ES_CHECKERS.find((c) => c.enSlug === slug)
  return m ? `/es/${m.slug}` : '/es'
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const current = localeOf(pathname)

  function choose(target: Loc) {
    if (target === current) return
    try {
      localStorage.setItem('sc-lang', target)
      document.cookie = `sc-lang=${target};path=/;max-age=31536000;samesite=lax`
    } catch { /* ignore */ }
    router.push(localizedPath(pathname, target))
  }

  return (
    <label className={`flex items-center gap-1 text-xs text-zinc-400 ${className}`}>
      <span className="sr-only">Language / Idioma</span>
      <span aria-hidden>🌐</span>
      <select
        value={current}
        onChange={(e) => choose(e.target.value as Loc)}
        aria-label="Choose language"
        className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-200"
      >
        {OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
      </select>
    </label>
  )
}
