'use client'

// components/i18n/language-switcher.tsx
// Locale selector for ScamCheck. Page content is rendered per-route (English at
// the root, full Spanish at /es), so switching language NAVIGATES to the
// localized URL rather than trying to swap text in place (which previously did
// nothing — the selector changed state but no content was bound to it).
//
// Languages offered all have full translated pages: English (/), Español (/es),
// हिन्दी (/hi). Selecting a language navigates to the localized URL.

import { usePathname, useRouter } from 'next/navigation'
import { ES_CHECKERS } from '@/lib/scamcheck/es-pages'

type Loc = 'en' | 'es' | 'hi'
const OPTIONS: { code: Loc; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'Español' },
]
// es and hi share the same localized checker slugs, so one map covers both.
const SLUGS = ES_CHECKERS.map((c) => ({ slug: c.slug, enSlug: c.enSlug }))

/** Current locale from the path. */
function localeOf(path: string): Loc {
  if (path === '/es' || path.startsWith('/es/')) return 'es'
  if (path === '/hi' || path.startsWith('/hi/')) return 'hi'
  return 'en'
}

/** Map the current path to its equivalent in the target locale. */
export function localizedPath(path: string, target: Loc): string {
  // Normalise to the English equivalent first.
  let en = path
  const m = /^\/(es|hi)(?:\/(.*))?$/.exec(path)
  if (m) {
    const sub = m[2]
    if (!sub) en = '/'
    else { const hit = SLUGS.find((s) => s.slug === sub); en = hit ? `/${hit.enSlug}` : '/' }
  }
  if (target === 'en') return en
  const prefix = `/${target}` // /es or /hi
  if (en === '/') return prefix
  const slug = en.replace(/^\//, '')
  const hit = SLUGS.find((s) => s.enSlug === slug)
  return hit ? `${prefix}/${hit.slug}` : prefix
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
