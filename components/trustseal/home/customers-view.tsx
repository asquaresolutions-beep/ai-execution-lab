// components/trustseal/home/customers-view.tsx  (asq-trustseal-conversion)
// Real Customers page: the live verified-domain list is genuine social proof (each
// links to its public seal page); plus use cases and an honest testimonials
// framework. Server component — verified domains fetched at render (ISR).
import type { Locale } from '@/lib/trustseal/locales'
import type { FeedItem } from '@/lib/trustseal/home-data'
import { customersContent } from '@/lib/trustseal/content/customers'

const C = { bg: '#050811', text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee' }
const card: React.CSSProperties = { background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))', border: '1px solid rgba(120,160,255,0.14)', borderRadius: 16 }

export function CustomersView({ locale, verified = [] }: { locale: Locale; verified?: FeedItem[] }) {
  const c = customersContent[locale] ?? customersContent.en
  const L = (s: string) => `/${locale}${s}`
  return (
    <main className="px-6 py-16" style={{ background: `radial-gradient(1100px 560px at 70% -10%, rgba(56,189,248,0.10), transparent 60%), ${C.bg}`, color: C.text1, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <h1 className="mx-auto max-w-3xl text-center text-3xl font-bold sm:text-4xl">{c.title}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm" style={{ color: C.text2 }}>{c.subtitle}</p>

      {/* Live verified businesses — real social proof */}
      <section className="mx-auto mt-10 max-w-4xl">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: C.text2 }}>{c.verifiedHeading}</h2>
        {verified.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: C.text3 }}>{c.verifiedEmpty}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {verified.map((v) => (
              <a key={v.domain} href={`${L('/trust')}/${encodeURIComponent(v.domain)}`} className="flex items-center gap-2 p-4" style={card}>
                <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: '#34d399', color: '#06121e' }}>✓</span>
                <span className="min-w-0 truncate text-sm font-semibold" style={{ color: C.text1 }}>{v.domain}</span>
                <span className="ms-auto text-[11px]" style={{ color: C.cyan }}>{c.verifiedCta} →</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Use cases */}
      <section className="mx-auto mt-12 max-w-4xl">
        <h2 className="text-center text-2xl font-bold">{c.useCasesHeading}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {c.useCases.map((u) => (
            <div key={u.title} className="p-5" style={card}>
              <h3 className="font-semibold">{u.title}</h3>
              <p className="mt-1.5 text-sm" style={{ color: C.text2 }}>{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials framework (honest — no fabricated quotes) */}
      <section className="mx-auto mt-12 max-w-2xl text-center p-6" style={card}>
        <h2 className="text-lg font-semibold">{c.testimonialsHeading}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: C.text2 }}>{c.testimonialsBody}</p>
        <a href="mailto:contact@asquaresolution.com?subject=TrustSeal%20customer%20story" className="mt-4 inline-flex rounded-lg px-5 py-2 text-sm font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{c.testimonialsCta}</a>
      </section>
    </main>
  )
}
