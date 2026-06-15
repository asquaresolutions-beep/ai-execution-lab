// components/trustseal/legal/legal-view.tsx  (asq-trustseal-harden-legal)
// Renders one legal document with localized chrome: a policy index (internal
// linking), a section table-of-contents, the body, and a contact line. Server
// component — bodies are English (controlling language), chrome is localized.
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'
import { formatDate } from '@/lib/trustseal/format'
import { LEGAL_DOCS, LEGAL_SLUGS, LEGAL_CONTACT, LEGAL_UPDATED, type LegalDoc } from '@/lib/trustseal/legal-content'

const slugLabelKey: Record<string, string> = {
  license: 'legal.license',
  'trademark-policy': 'legal.trademark',
  copyright: 'legal.copyright',
  security: 'legal.security',
  'code-of-conduct': 'legal.conduct',
  privacy: 'legal.privacy',
  terms: 'legal.terms',
  'acceptable-use': 'legal.acceptableUse',
  dmca: 'legal.dmca',
}

// Index-based ids — robust across scripts (Latin / Devanagari / Arabic).
const anchor = (i: number) => `section-${i + 1}`

export function LegalView({ locale, doc }: { locale: Locale; doc: LegalDoc }) {
  const x = (k: string) => t(locale, k)
  const L = (s: string) => `/${locale}${s}`
  const border = { borderColor: 'rgb(var(--ts-border))' } as const
  const muted = { color: 'rgb(var(--ts-text-2))' } as const

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--ts-accent))' }}>
        {x('legal.center')}
      </p>
      <h1 className="mt-2 text-3xl font-bold" style={{ color: 'rgb(var(--ts-text-1))' }}>{doc.title}</h1>
      <p className="mt-2 text-sm" style={muted}>{x('legal.lastUpdated')}: {formatDate(locale, LEGAL_UPDATED)}</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        {/* policy index — internal linking */}
        <nav aria-label={x('legal.policies')} className="order-2 lg:order-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={muted}>{x('legal.policies')}</p>
          <ul className="space-y-1 border-s ps-3 text-sm" style={border}>
            {LEGAL_SLUGS.map((s) => (
              <li key={s}>
                <a href={L(`/legal/${s}`)} aria-current={s === doc.slug ? 'page' : undefined}
                  className="block py-0.5 hover:opacity-80"
                  style={{ color: s === doc.slug ? 'rgb(var(--ts-accent))' : 'rgb(var(--ts-text-2))', fontWeight: s === doc.slug ? 600 : 400 }}>
                  {x(slugLabelKey[s])}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="order-1 min-w-0 lg:order-2">
          <p className="rounded-lg border px-3 py-2 text-xs" style={{ ...border, ...muted }}>{x('legal.englishNotice')}</p>
          <p className="mt-4 text-base" style={{ color: 'rgb(var(--ts-text-1))' }}>{doc.intro}</p>

          {/* section table of contents */}
          {doc.sections.length > 1 && (
            <nav aria-label={x('legal.onThisPage')} className="mt-6 rounded-lg border p-4" style={border}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={muted}>{x('legal.onThisPage')}</p>
              <ol className="list-inside list-decimal space-y-1 text-sm">
                {doc.sections.map((sec, i) => (
                  <li key={i}><a href={`#${anchor(i)}`} className="hover:underline" style={{ color: 'rgb(var(--ts-accent))' }}>{sec.heading}</a></li>
                ))}
              </ol>
            </nav>
          )}

          {doc.sections.map((sec, i) => (
            <section key={i} id={anchor(i)} className="mt-8 scroll-mt-24">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{sec.heading}</h2>
              {sec.paras?.map((p, i) => (
                <p key={i} className="mt-2 text-sm leading-relaxed" style={muted}>{p}</p>
              ))}
              {sec.bullets && (
                <ul className="mt-2 list-disc space-y-1 ps-5 text-sm leading-relaxed" style={muted}>
                  {sec.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
            </section>
          ))}

          <p className="mt-10 border-t pt-6 text-sm" style={{ ...border, ...muted }}>
            {x('legal.contact')} <a href={`mailto:${LEGAL_CONTACT}`} style={{ color: 'rgb(var(--ts-accent))' }}>{LEGAL_CONTACT}</a>.
            <br />© 2026 A Square Solutions. {t(locale, 'common.copyright').replace(/^©\s*2026\s*A Square Solutions\.\s*/, '')}
          </p>
        </article>
      </div>
    </main>
  )
}

export { LEGAL_DOCS }
