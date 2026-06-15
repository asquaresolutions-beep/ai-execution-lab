// components/trustseal/content-page.tsx  (asq-trustseal-harden)
// Renders a fully-localized ContentPage (Security / Docs / About) with an
// optional section table-of-contents for in-page navigation. Server component.
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'
import type { ContentPage } from '@/lib/trustseal/content/types'

// Index-based ids — robust across scripts (Latin / Devanagari / Arabic).
const anchor = (i: number) => `section-${i + 1}`

export function ContentPageView({ locale, page, toc = false }: { locale: Locale; page: ContentPage; toc?: boolean }) {
  const border = { borderColor: 'rgb(var(--ts-border))' } as const
  const muted = { color: 'rgb(var(--ts-text-2))' } as const
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold" style={{ color: 'rgb(var(--ts-text-1))' }}>{page.title}</h1>
      <p className="mt-3 text-base" style={muted}>{page.subtitle}</p>

      {toc && page.sections.length > 1 && (
        <nav aria-label={t(locale, 'legal.onThisPage')} className="mt-6 rounded-lg border p-4" style={border}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={muted}>{t(locale, 'legal.onThisPage')}</p>
          <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {page.sections.map((s, i) => (
              <li key={i}><a href={`#${anchor(i)}`} className="text-sm hover:underline" style={{ color: 'rgb(var(--ts-accent))' }}>{s.heading}</a></li>
            ))}
          </ol>
        </nav>
      )}

      {page.sections.map((s, i) => (
        <section key={i} id={anchor(i)} className="mt-8 scroll-mt-24">
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{s.heading}</h2>
          {s.paras?.map((p, j) => <p key={j} className="mt-2 text-sm leading-relaxed" style={muted}>{p}</p>)}
          {s.bullets && (
            <ul className="mt-2 list-disc space-y-1 ps-5 text-sm leading-relaxed" style={muted}>
              {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
            </ul>
          )}
        </section>
      ))}
    </main>
  )
}
