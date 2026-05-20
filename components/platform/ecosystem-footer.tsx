/**
 * components/platform/ecosystem-footer.tsx
 *
 * Sitewide ecosystem footer — surfaces cross-property navigation,
 * the "Built in Public" authority statement, and operational identity
 * across all pages of AI Execution Lab.
 *
 * Renders as a server component (no client state needed).
 */

import Link from 'next/link'

const ECOSYSTEM_LINKS = [
  {
    label:    'A Square Solutions',
    href:     'https://asquaresolution.com',
    desc:     'Production WordPress & AI engineering',
    external: true,
    accent:   'text-brand-400',
  },
  {
    label:    'AI Execution Lab',
    href:     'https://lab.asquaresolution.com',
    desc:     'This site — operational records',
    external: false,
    accent:   'text-emerald-400',
  },
  {
    label:    'TrustSeal',
    href:     'https://trustseal.io',
    desc:     'AI trust verification tool',
    external: true,
    accent:   'text-blue-400',
  },
  {
    label:    'ScamCheck',
    href:     'https://scamcheck.tools',
    desc:     'AI scam detection tool',
    external: true,
    accent:   'text-amber-400',
  },
]

const NAV_SECTIONS = [
  {
    heading: 'Evidence',
    links: [
      { label: 'Failure Archive',  href: '/failures' },
      { label: 'Execution Logs',   href: '/logs' },
      { label: 'Case Studies',     href: '/case-studies' },
    ],
  },
  {
    heading: 'Reference',
    links: [
      { label: 'Docs',             href: '/docs' },
      { label: 'Playbooks',        href: '/playbooks' },
      { label: 'Systems',          href: '/systems' },
    ],
  },
  {
    heading: 'Strategy',
    links: [
      { label: 'Authority Flywheel',  href: '/docs/authority-flywheel' },
      { label: 'Distribution System', href: '/docs/distribution-system' },
      { label: 'Build in Public',     href: '/docs/build-in-public-framework' },
    ],
  },
  {
    heading: 'Platform',
    links: [
      { label: 'Execution Tracks', href: '/tracks' },
      { label: 'Start Here',       href: '/start-here' },
      { label: 'Operations',       href: '/ops' },
    ],
  },
]

export function EcosystemFooter() {
  return (
    <footer className="mt-auto border-t border-white/[0.05] bg-black/20">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">

        {/* ── Ecosystem properties ─────────────────────────────── */}
        <div className="mb-6 pb-6 border-b border-white/[0.05]">
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-surface-700 mb-3">
            A Square Solutions Ecosystem
          </p>
          <div className="flex flex-wrap gap-4">
            {ECOSYSTEM_LINKS.map(link => (
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-1.5"
                >
                  <div>
                    <p className={`text-xs font-semibold group-hover:opacity-80 transition-opacity ${link.accent}`}>
                      {link.label} ↗
                    </p>
                    <p className="text-[10px] text-surface-700">{link.desc}</p>
                  </div>
                </a>
              ) : (
                <Link
                  key={link.href}
                  href="/"
                  className="group flex items-start gap-1.5"
                >
                  <div>
                    <p className={`text-xs font-semibold group-hover:opacity-80 transition-opacity ${link.accent}`}>
                      {link.label}
                    </p>
                    <p className="text-[10px] text-surface-700">{link.desc}</p>
                  </div>
                </Link>
              )
            ))}
          </div>
        </div>

        {/* ── Nav grid ─────────────────────────────────────────── */}
        <div className="mb-6 pb-6 border-b border-white/[0.05] grid grid-cols-2 sm:grid-cols-4 gap-4">
          {NAV_SECTIONS.map(section => (
            <div key={section.heading}>
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-surface-700 mb-2">
                {section.heading}
              </p>
              <div className="space-y-1.5">
                {section.links.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block text-xs text-surface-500 hover:text-surface-300 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Authority statement ──────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[10px] text-surface-700 max-w-lg leading-relaxed">
            A Square Solutions builds production AI systems. Engineering decisions, deployments, debugging sessions,
            and production failures are documented publicly at AI Execution Lab as they happen —
            not summaries, not retrospectives, operational records.
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-surface-700 sm:text-right">
            <Link href="/ops" className="hover:text-surface-400 transition-colors">Ops →</Link>
            <Link href="/ops/retrieval" className="hover:text-surface-400 transition-colors">Retrieval →</Link>
            <Link href="/ops/seo" className="hover:text-surface-400 transition-colors">SEO →</Link>
            <Link href="/sitemap.xml" className="hover:text-surface-400 transition-colors">Sitemap →</Link>
          </div>
        </div>

      </div>
    </footer>
  )
}
