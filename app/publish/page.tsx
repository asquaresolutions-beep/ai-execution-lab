import Link from 'next/link'
import type { Metadata } from 'next'
import { CONTENT_TEMPLATES, getCapturePriorityOrder } from '@/lib/content-templates'
import { getAllMeta } from '@/lib/content'
import { getFailureMemorySummary } from '@/lib/failure-memory'
import { formatDateMono, cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Publish — AI Execution Lab',
  description: 'Rapid publishing hub: content templates, capture workflow, and publishing backlog.',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const SECTION_ACCENT: Record<string, string> = {
  failures:      'text-red-400',
  logs:          'text-green-400',
  'case-studies':'text-emerald-400',
  labs:          'text-purple-400',
  docs:          'text-blue-400',
  playbooks:     'text-brand-400',
}

const CAPTURE_COLOR: Record<string, string> = {
  '15 min': 'text-green-400',
  '20 min': 'text-green-400',
  '30 min': 'text-green-400',
  '45 min': 'text-yellow-400',
  '60 min': 'text-yellow-400',
  '2 h':    'text-orange-400',
}

// ─────────────────────────────────────────────────────────────
// Template card
// ─────────────────────────────────────────────────────────────

function TemplateCard({ template }: { template: typeof CONTENT_TEMPLATES[number] }) {
  const accentColor = SECTION_ACCENT[template.section] ?? 'text-surface-400'
  const captureColor = CAPTURE_COLOR[template.captureTarget] ?? 'text-surface-400'

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-surface-200">{template.title}</h3>
          <span className={cn('text-[10px] font-mono', accentColor)}>/{template.section}/</span>
        </div>
        <span className={cn('text-[10px] font-mono shrink-0', captureColor)}>
          ~{template.captureTarget}
        </span>
      </div>

      <p className="text-xs text-surface-500 leading-relaxed mb-4 flex-1">
        {template.description}
      </p>

      {/* Minimum bar */}
      <div className="mb-4">
        <p className="text-[10px] font-mono text-surface-700 mb-2 uppercase tracking-wide">Minimum bar</p>
        <ul className="space-y-1">
          {template.minimumBar.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-surface-600">
              <span className="text-surface-700 shrink-0 mt-0.5">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Template path */}
      <div className="rounded-lg bg-surface-900/60 border border-white/[0.04] px-3 py-2 mb-3">
        <p className="text-[10px] font-mono text-surface-600 mb-0.5">Template</p>
        <code className="text-[11px] text-brand-400">{template.templatePath}</code>
      </div>

      {/* Commit pattern */}
      <code className="text-[10px] font-mono text-surface-700 bg-surface-900/40 rounded px-2 py-1 border border-white/[0.04] block">
        {template.commitPattern}
      </code>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Publishing queue — recent items for audit
// ─────────────────────────────────────────────────────────────

function RecentlyPublished() {
  const sections = ['failures', 'logs', 'case-studies', 'labs'] as const
  const recent = sections.flatMap(s =>
    getAllMeta(s as Parameters<typeof getAllMeta>[0]).slice(0, 3).map(i => ({ ...i, section: s }))
  ).sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())
  .slice(0, 8)

  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
        Recently Published
      </h2>
      <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
        {recent.map(item => {
          const ac = SECTION_ACCENT[item.section] ?? 'text-surface-400'
          return (
            <Link
              key={`${item.section}/${item.slug}`}
              href={`/${item.section}/${item.slug}`}
              className="group flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
            >
              <span className={cn('text-[10px] font-mono w-16 shrink-0', ac)}>
                {item.section.replace('case-studies', 'cases')}
              </span>
              <span className="text-xs text-surface-400 group-hover:text-surface-200 transition-colors flex-1 truncate">
                {item.frontmatter.title}
              </span>
              <time className="text-[10px] font-mono text-surface-700 shrink-0">
                {formatDateMono(item.frontmatter.date)}
              </time>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function PublishPage() {
  const priorityOrder = getCapturePriorityOrder()
  const failureSummary = getFailureMemorySummary()

  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-surface-500 bg-surface-800/60 border-surface-700/40">
            PUBLISH
          </span>
          <Link href="/ops" className="text-[10px] font-mono text-surface-700 hover:text-brand-400 transition-colors">
            ← Ops
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Operational Publishing
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          Convert operational experiences to published intelligence. Open the right template,
          fill in the blanks, commit, push. Target: under 30 minutes from experience to published.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Templates',         value: CONTENT_TEMPLATES.length, color: 'text-brand-400' },
          { label: 'Failures Documented', value: failureSummary.totalFailures, color: 'text-red-400' },
          { label: 'Avg Confidence',     value: `${failureSummary.avgConfidence}/100`, color: 'text-green-400' },
          { label: 'Pathways',           value: 5, color: 'text-purple-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center">
            <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
            <p className="text-[10px] font-mono text-surface-600 mt-1 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — templates */}
        <div className="lg:col-span-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
            Content Templates — Priority Order
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {priorityOrder.map(t => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>

          {/* Workflow steps */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
              30-Minute Capture Workflow
            </h2>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {[
                { step: '01', time: '2 min',  label: 'Open template',      desc: 'Copy templates/[type].mdx to content/[section]/[slug].mdx' },
                { step: '02', time: '5 min',  label: 'Fill frontmatter',   desc: 'Title, description, date, tags, status, section-specific fields' },
                { step: '03', time: '10 min', label: 'Write core content', desc: 'Accuracy over polish. Fill the pre-structured sections.' },
                { step: '04', time: '5 min',  label: 'Attach evidence',    desc: 'Screenshot filenames, terminal blocks, commit refs, resolution time' },
                { step: '05', time: '3 min',  label: 'Quality check',      desc: 'Root cause specific? Evidence attached? Minimum bar met?' },
                { step: '06', time: '2 min',  label: 'Commit and push',    desc: 'git add → git commit -m "content: [type] — [slug]" → git push' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-4 px-4 py-3">
                  <span className="text-[10px] font-mono text-surface-700 shrink-0 w-6">{s.step}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-surface-300">{s.label}</p>
                    <p className="text-[11px] text-surface-600 mt-0.5">{s.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono text-surface-700 shrink-0">{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — recent + links */}
        <div className="space-y-6">

          <RecentlyPublished />

          {/* Quick links */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Publishing Links
            </h2>
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {[
                { href: '/failures',       label: 'Failure Archive',      badge: `${failureSummary.totalFailures}` },
                { href: '/logs',           label: 'Execution Logs',       badge: '' },
                { href: '/case-studies',   label: 'Case Studies',         badge: '' },
                { href: '/pathways',       label: 'Pathways',             badge: '5' },
                { href: '/playbooks',      label: 'Playbooks',            badge: '' },
                { href: '/docs/operational-publishing-workflow', label: 'Publishing Playbook', badge: '' },
                { href: '/docs/content-velocity-system', label: 'Velocity System', badge: '' },
              ].map(({ href, label, badge }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-xs text-surface-400 group-hover:text-surface-200 transition-colors">{label}</span>
                  <div className="flex items-center gap-2">
                    {badge && <span className="text-[10px] font-mono text-surface-700">{badge}</span>}
                    <span className="text-surface-700 group-hover:text-surface-400 transition-colors text-xs">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Capture principles */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-3">
              Capture Principles
            </h2>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 space-y-3 text-[11px] text-surface-600 leading-relaxed">
              <p><span className="text-surface-400 font-medium">Capture first.</span> Don&apos;t wait until an experience is "interesting enough." Capture now, decide later.</p>
              <p><span className="text-surface-400 font-medium">Specificity over polish.</span> A 200-word failure report with a crisp root cause is more valuable than a 2,000-word essay.</p>
              <p><span className="text-surface-400 font-medium">Evidence degrades fast.</span> The exact error message, the debugging sequence, the specific config — all of it fades within 24 hours.</p>
              <p><span className="text-surface-400 font-medium">The moat is the work.</span> Every real incident report is an entity in a graph that cannot be manufactured by AI content farms.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
