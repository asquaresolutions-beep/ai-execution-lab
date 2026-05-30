import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { PageModel, InternalLink } from '@/lib/seo/programmatic'

const TRUST_BADGE: Record<string, string> = {
  authoritative: 'text-green-400 border-green-500/30 bg-green-500/10',
  verified: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  standard: 'text-neutral-400 border-neutral-700 bg-neutral-800/50',
}

const LINK_GROUP_LABEL: Record<InternalLink['group'], string> = {
  'related-scams': 'Related scams',
  'related-alerts': 'Related alerts',
  trending: 'Trending now',
  latest: 'Latest',
  facet: 'See also',
}

export function ProgrammaticPage({ model }: { model: PageModel }) {
  const groups = groupLinks(model.internalLinks)
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* JSON-LD */}
      {model.schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-500">
        {model.breadcrumb.map((c, i) => (
          <span key={c.href}>
            {i > 0 && <span className="mx-1.5">/</span>}
            <Link href={c.href} className="hover:text-neutral-300">{c.name}</Link>
          </span>
        ))}
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">{model.h1}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-neutral-500">{model.discover.freshnessLabel}</span>
          <span className={cn('rounded border px-2 py-0.5 font-medium', TRUST_BADGE[model.trust.band])}>
            Trust: {model.trust.band} ({model.trust.score})
          </span>
        </div>
      </header>

      {/* Direct answer — leads the page for AI Overviews */}
      <section className="mb-5 rounded-lg border border-indigo-500/25 bg-indigo-500/10 p-4">
        <p className="text-[15px] leading-relaxed text-neutral-100">{model.directAnswer}</p>
      </section>

      {/* Verdict snippet */}
      <p className="mb-5 rounded-md border-l-2 border-amber-400 bg-amber-500/5 px-3 py-2 text-sm font-medium text-amber-200">
        {model.verdict}
      </p>

      {/* Quick bullets */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">Quick summary</h2>
        <ul className="space-y-1.5 text-sm text-neutral-200">
          {model.quickBullets.map((b, i) => <li key={i} className="flex gap-2"><span className="text-indigo-400">•</span>{b}</li>)}
        </ul>
      </section>

      {/* Structured summary */}
      <section className="mb-6 overflow-hidden rounded-lg border border-neutral-800">
        <dl className="divide-y divide-neutral-800 text-sm">
          {model.structuredSummary.map((r) => (
            <div key={r.label} className="flex justify-between gap-4 px-3 py-2">
              <dt className="text-neutral-500">{r.label}</dt>
              <dd className="text-right font-medium text-neutral-200">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Sections */}
      {model.sections.map((s) => (
        <section key={s.heading} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold text-white">{s.heading}</h2>
          <ul className="space-y-1.5 text-sm text-neutral-300">
            {s.body.map((b, i) => <li key={i} className="flex gap-2"><span className="text-neutral-600">—</span>{b}</li>)}
          </ul>
        </section>
      ))}

      {/* FAQ — FAQ-first formatting */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-white">Frequently asked questions</h2>
        <div className="space-y-2">
          {model.faq.map((f, i) => (
            <details key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-neutral-100">{f.question}</summary>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">{f.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Hindi (GEO) */}
      <section className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4" lang="hi">
        <h2 className="mb-2 text-base font-semibold text-white">{model.hi.h1}</h2>
        <p className="text-sm leading-relaxed text-neutral-200">{model.hi.directAnswer}</p>
        <p className="mt-2 text-sm font-medium text-amber-200">{model.hi.verdict}</p>
      </section>

      {/* Authority references */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">Official sources & helplines</h2>
        <ul className="space-y-1.5 text-sm">
          {model.references.map((r) => (
            <li key={r.url}>
              <a href={r.url} className="text-indigo-400 hover:underline" rel="nofollow noopener">{r.label}</a>
              <span className="text-neutral-500"> — {r.note}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Internal linking */}
      <section className="border-t border-neutral-800 pt-5">
        {Object.entries(groups).map(([group, links]) => (
          <div key={group} className="mb-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">{LINK_GROUP_LABEL[group as InternalLink['group']]}</h3>
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <Link key={l.href + l.group} href={l.href} className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-indigo-500/50 hover:text-white">
                  {l.anchor}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

function groupLinks(links: InternalLink[]): Record<string, InternalLink[]> {
  const out: Record<string, InternalLink[]> = {}
  for (const l of links) (out[l.group] ??= []).push(l)
  return out
}
