/**
 * app/docs/page.tsx
 *
 * Grouped docs index — navigable by operational intent, not chronology.
 * Replaces the flat SectionIndex with themed clusters.
 */

import Link from 'next/link'
import { getAllMeta } from '@/lib/content'
import { buildSectionMetadata } from '@/lib/metadata'
import { formatDateMono } from '@/lib/utils'
import { FeaturedArticles } from '@/components/lab/featured-articles'
import type { Metadata } from 'next'
import type { ContentMeta } from '@/lib/content'

export const metadata: Metadata = buildSectionMetadata(
  'Docs',
  'Reference documentation for production AI engineering — governance, observability, deployment, reliability, and operational systems.',
  '/docs',
)

// ─────────────────────────────────────────────────────────────
// Group definitions — ordered by operational priority
// ─────────────────────────────────────────────────────────────

const DOC_GROUPS = [
  {
    id:     'governance',
    label:  'Governance & Reliability',
    desc:   'Operational doctrine, invariants, and decision frameworks that govern how systems are changed and recovered.',
    accent: 'text-brand-400',
    dot:    'bg-brand-400',
    border: 'border-brand-500/15',
    slugs: [
      'operational-invariants',
      'incident-response-doctrine',
      'release-discipline-doctrine',
      'operator-decision-doctrine',
      'deployment-verification-checklist',
      'execution-checklist-system',
      'content-quality-standards',
      'platform-focus-lock',
    ],
  },
  {
    id:     'observability',
    label:  'Observability & Recovery',
    desc:   'Failure intelligence, detection patterns, and recovery procedures derived from real production incidents.',
    accent: 'text-red-400',
    dot:    'bg-red-400',
    border: 'border-red-500/15',
    slugs: [
      'production-observability-doctrine',
      'failure-intelligence-architecture',
      'failure-memory-architecture',
      'failure-pattern-library',
      'failure-intelligence-ux',
      'execution-observability-design',
      'evidence-framework',
      'evidence-indexing-architecture',
    ],
  },
  {
    id:     'security',
    label:  'Security & Cost Governance',
    desc:   'API mode isolation, quota enforcement, key hygiene, and cost controls for production AI systems.',
    accent: 'text-amber-400',
    dot:    'bg-amber-400',
    border: 'border-amber-500/15',
    slugs: [
      'operational-security-doctrine',
      'ai-cost-governance',
      'firebase-firestore-quota-enforcement',
      'third-party-api-mode-isolation',
    ],
  },
  {
    id:     'deployment',
    label:  'Deployment & Release',
    desc:   'Deploy workflows, Vercel operations, GitHub Pages SPA patterns, and launch checklists.',
    accent: 'text-indigo-400',
    dot:    'bg-indigo-400',
    border: 'border-indigo-500/15',
    slugs: [
      'deployment-workflow',
      'production-deployment-guide',
      'next-js-vercel-production-operations',
      'github-pages-spa-deployment',
      'launch-checklist',
      'launch-readiness-report',
      'launch-assets',
    ],
  },
  {
    id:     'ai-reliability',
    label:  'AI Reliability',
    desc:   'Gemini API production operations, output validation, AI research workflows, and GEO intelligence patterns.',
    accent: 'text-emerald-400',
    dot:    'bg-emerald-400',
    border: 'border-emerald-500/15',
    slugs: [
      'gemini-production-operations',
      'ai-output-structure-validation',
      'ai-research-workflow',
      'geo-intelligence-architecture',
      'claude-code-wp-rest-api',
    ],
  },
  {
    id:     'product-systems',
    label:  'Product Systems',
    desc:   'Integration documentation for live production systems — Razorpay, WordPress, Firebase, and schema infrastructure.',
    accent: 'text-purple-400',
    dot:    'bg-purple-400',
    border: 'border-purple-500/15',
    slugs: [
      'razorpay-subscription-integration',
      'wordpress-to-lab-linking',
      'wordpress-rollout-assets',
      'wordpress-rollout-run-card',
      'wordpress-schema-blocks-verification',
      'wordpress-homepage-blocks',
      'schema-org-entity-blocks',
      'ecosystem-schema-blocks',
    ],
  },
  {
    id:     'platform-guides',
    label:  'Platform Guides',
    desc:   'Publishing workflows, content templates, frontmatter reference, analytics setup, and operational onboarding.',
    accent: 'text-cyan-400',
    dot:    'bg-cyan-400',
    border: 'border-cyan-500/15',
    slugs: [
      'operational-onboarding-guide',
      'frontmatter-reference',
      'content-templates',
      'publishing-workflow',
      'publishing-operations',
      'publishing-cadence',
      'media-publishing-workflow',
      'ai-assisted-publishing-system',
      'content-queue-system',
      'content-velocity-system',
      'how-to-structure-operational-case-studies',
      'analytics-setup',
      'gsc-weekly-review-sop',
      'gsc-data-ingestion-guide',
      'execution-artifacts-architecture',
      'linkedin-content-engine',
      'linkedin-publishing-engine',
      'ecosystem-copy-blocks',
      'wordpress-launch-article',
    ],
  },
  {
    id:     'operational-lessons',
    label:  'Operational Lessons',
    desc:   'Conceptual foundations — what operational evidence is, how authority compounds, and why build-in-public works.',
    accent: 'text-green-400',
    dot:    'bg-green-400',
    border: 'border-green-500/15',
    slugs: [
      'what-is-execution-density',
      'what-is-operational-evidence',
      'what-is-operational-seo',
      'how-we-build',
      'build-in-public-framework',
      'authority-flywheel',
      'authority-compounding-system',
      'distribution-system',
      'distribution-engine',
    ],
  },
] as const

// ─────────────────────────────────────────────────────────────
// DocItem — single row
// ─────────────────────────────────────────────────────────────

function DocItem({ item, dot }: { item: ContentMeta; dot: string }) {
  return (
    <Link
      href={`/docs/${item.slug}`}
      className="group flex items-start gap-4 rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3 hover:border-white/[0.10] hover:bg-white/[0.04] transition-all"
    >
      <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-200 group-hover:text-surface-50 transition-colors truncate">
          {item.frontmatter.title}
        </p>
        {item.frontmatter.description && (
          <p className="mt-0.5 text-xs text-surface-600 line-clamp-1 leading-snug">
            {item.frontmatter.description}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10px] font-mono text-surface-700 pt-0.5">
        {item.readingTime}
      </span>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// DocGroup — labelled cluster
// ─────────────────────────────────────────────────────────────

function DocGroup({
  label,
  desc,
  accent,
  dot,
  border,
  items,
}: {
  label:  string
  desc:   string
  accent: string
  dot:    string
  border: string
  items:  ContentMeta[]
}) {
  if (items.length === 0) return null
  return (
    <section className="mb-8">
      <div className={`flex items-start gap-3 mb-3 pb-3 border-b ${border}`}>
        <div className="flex-1 min-w-0">
          <h2 className={`text-[11px] font-mono font-bold uppercase tracking-widest ${accent}`}>
            {label}
          </h2>
          <p className="mt-1 text-xs text-surface-600 leading-snug">{desc}</p>
        </div>
        <span className="text-[10px] font-mono text-surface-700 shrink-0 pt-0.5">
          {items.length} {items.length === 1 ? 'doc' : 'docs'}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <DocItem key={item.slug} item={item} dot={dot} />
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function DocsPage() {
  const all    = getAllMeta('docs')
  const bySlug = new Map(all.map(item => [item.slug, item]))

  // Assign to groups and track which slugs are matched
  const assignedSlugs = new Set<string>()
  const groups = DOC_GROUPS.map(group => {
    const items = group.slugs
      .map(s => bySlug.get(s))
      .filter((x): x is ContentMeta => x !== undefined)
    items.forEach(item => assignedSlugs.add(item.slug))
    return { ...group, items }
  })

  // Remaining docs — sorted by date desc
  const remaining = all
    .filter(item => !assignedSlugs.has(item.slug))
    .sort((a, b) =>
      new Date(b.frontmatter.date).getTime() -
      new Date(a.frontmatter.date).getTime()
    )

  const totalDocs = all.length

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-emerald-400 bg-emerald-500/10 border-emerald-500/25">
            DOCS
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Reference Documentation
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          {totalDocs} documents across operational doctrine, deployment systems, AI reliability,
          and product engineering. Grouped by intent — not by date.
        </p>

        {/* Group jump nav */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {DOC_GROUPS.map(g => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className={`text-[10px] font-mono px-2 py-1 rounded border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] transition-colors ${g.accent}`}
            >
              {g.label}
            </a>
          ))}
          {remaining.length > 0 && (
            <a
              href="#reference"
              className="text-[10px] font-mono px-2 py-1 rounded border border-white/[0.07] bg-white/[0.02] text-surface-600 hover:text-surface-400 hover:bg-white/[0.05] transition-colors"
            >
              Reference &amp; Architecture
            </a>
          )}
        </div>
      </div>

      {/* Featured (above the normal lists) */}
      <FeaturedArticles heading="Featured" />

      {/* ── Groups ─────────────────────────────────────────── */}
      {groups.map(group => (
        <div key={group.id} id={group.id}>
          <DocGroup {...group} />
        </div>
      ))}

      {/* ── Catch-all ──────────────────────────────────────── */}
      {remaining.length > 0 && (
        <div id="reference">
          <DocGroup
            label="Reference & Architecture"
            desc="Platform architecture, roadmaps, audits, and operational strategy documents."
            accent="text-surface-500"
            dot="bg-surface-600"
            border="border-white/[0.07]"
            items={remaining}
          />
        </div>
      )}

    </div>
  )
}
