// components/scamcheck/scan-cta.tsx
// asq-scancta-v1 — contextual conversion CTA: a primary "scan now" action plus
// relevant checker suggestions (better conversion path than a plain link list).
// Server component, static → zero CLS, no client JS. Reuses card/button/chip
// styles. Does NOT touch scan functionality (links only).
// Rollback: delete this file + its <ScanCTA/> usages (marked asq-scancta-v1).
import Link from 'next/link'
import { CHECKERS } from '@/lib/scamcheck/checkers'

export function ScanCTA({
  currentSlug,
  heading = 'Check another scam type — free',
  scanHref = '#scanner',
  className = '',
}: {
  currentSlug?: string
  heading?: string
  scanHref?: string
  className?: string
}) {
  const others = CHECKERS.filter((c) => c.slug !== currentSlug).slice(0, 6)
  return (
    <section className={`rounded-2xl border border-sky-500/30 bg-sky-500/[0.06] p-5 text-center ${className}`}>
      <h2 className="text-lg font-semibold text-zinc-100">{heading}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">
        Free, instant, no sign-up — paste a message, link, email, phone number, or upload a screenshot.
      </p>
      <div className="mt-4 flex justify-center">
        <a
          href={scanHref}
          className="rounded-xl bg-sky-500 px-7 py-3 font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 hover:shadow-sky-500/40"
        >
          Scan something now
        </a>
      </div>
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {others.map((o) => (
          <li key={o.slug}>
            <Link
              href={`/${o.slug}`}
              className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-600"
            >
              {o.h1}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/scam-intelligence"
            className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs text-sky-400 hover:border-zinc-600"
          >
            Trending campaigns →
          </Link>
        </li>
      </ul>
    </section>
  )
}
