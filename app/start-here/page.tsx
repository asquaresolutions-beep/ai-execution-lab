import type { Metadata } from 'next'
import Link from 'next/link'
import { getEvidenceMetrics, formatOperationalHours, formatAvgResolution } from '@/lib/evidence-metrics'

// ─────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Start Here — AI Execution Lab',
  description:
    'New to AI Execution Lab? Find your entry point — whether you are an operator, builder, marketer, or developer. Recommended pathways by role and goal.',
  alternates: { canonical: 'https://lab.asquaresolution.com/start-here' },
}

// ─────────────────────────────────────────────────────────────
// Persona definitions
// ─────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    id: 'operator',
    label: 'Operator / Developer',
    icon: '⬡',
    iconColor: 'text-brand-400',
    borderColor: 'border-brand-500/20',
    bgColor: 'bg-brand-500/[0.04]',
    tagColor: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
    description:
      'You build and maintain production systems. You use Claude Code daily or want to. You care about reliability, deployment, debugging, and actual workflows — not theory.',
    firstStep: {
      label: 'Start with the Claude Code Operator track',
      href: '/tracks/claude-code-operator',
    },
    pathway: [
      { label: 'Dev Environment Setup', href: '/tracks/claude-code-operator/foundations/dev-environment', type: 'Lesson' },
      { label: 'CLAUDE.md Architecture', href: '/tracks/claude-code-operator/foundations/claude-md-architecture', type: 'Lesson' },
      { label: 'Anatomy of a Production Prompt', href: '/tracks/claude-code-operator/prompt-engineering/production-prompt-anatomy', type: 'Lesson' },
      { label: 'Git Operations with Claude Code', href: '/tracks/claude-code-operator/github-workflows/git-operations', type: 'Lesson' },
      { label: 'Build Failure Diagnosis', href: '/tracks/claude-code-operator/vercel-deployment/build-failure-diagnosis', type: 'Playbook' },
    ],
    alsoRead: [
      { label: 'Operational Onboarding Guide', href: '/docs/operational-onboarding-guide', note: '— how A Square Solutions operates its systems' },
      { label: 'Failure Archive', href: '/failures', note: '— real production incidents with exact fixes' },
      { label: 'WordPress REST API Playbook', href: '/playbooks/wp-rest-api-automation-playbook', note: '— if you automate WordPress' },
    ],
  },
  {
    id: 'founder',
    label: 'Founder / Builder',
    icon: '▲',
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    bgColor: 'bg-amber-500/[0.04]',
    tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    description:
      'You are building or planning to build an AI-powered product or content business. You want to move fast with minimal infrastructure cost. You want distribution that doesn\'t require an ad budget.',
    firstStep: {
      label: 'Start with the AI Business Zero Budget track',
      href: '/tracks/ai-business-zero-budget',
    },
    pathway: [
      { label: 'Choosing Your First AI Product', href: '/tracks/ai-business-zero-budget/zero-budget-stack/choosing-your-product', type: 'Lesson' },
      { label: 'Free-Tier Infrastructure Architecture', href: '/tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture', type: 'Lesson' },
      { label: 'AI Tool Stack Under $40/Month', href: '/tracks/ai-business-zero-budget/zero-budget-stack/ai-tool-stack-budget', type: 'Lesson' },
      { label: 'Claude + WordPress Operational Workflow', href: '/tracks/ai-business-zero-budget/zero-budget-stack/claude-wordpress-workflow', type: 'Playbook' },
      { label: 'Your First Organic Traffic System', href: '/tracks/ai-business-zero-budget/zero-budget-stack/first-organic-traffic-system', type: 'Lesson' },
    ],
    alsoRead: [
      { label: 'How to Avoid Tool Subscription Traps', href: '/tracks/ai-business-zero-budget/zero-budget-stack/avoid-tool-subscription-traps', note: '— before you spend anything' },
      { label: 'AdSense Approval Reality', href: '/tracks/ai-business-zero-budget/zero-budget-stack/adsense-approval-reality', note: '— realistic monetization expectations' },
    ],
  },
  {
    id: 'marketer',
    label: 'Marketer / Content Operator',
    icon: '◈',
    iconColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/20',
    bgColor: 'bg-cyan-500/[0.04]',
    tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    description:
      'You run content operations, SEO, or are trying to understand how AI search systems (ChatGPT, Perplexity, Gemini) decide what to cite. You want your content to appear in AI-generated answers.',
    firstStep: {
      label: 'Start with the GEO + AI Search Systems track',
      href: '/tracks/geo-ai-search',
    },
    pathway: [
      { label: 'GEO vs SEO: What Actually Changed', href: '/tracks/geo-ai-search/ai-search-mechanics/geo-vs-seo', type: 'Lesson' },
      { label: 'Content Systems Thinking', href: '/tracks/ai-content-distribution/content-architecture/content-systems-thinking', type: 'Lesson' },
      { label: 'Google Search Console Setup', href: '/tracks/ai-business-zero-budget/zero-budget-stack/google-search-console-setup', type: 'Playbook' },
      { label: 'Google Analytics + Data Thinking', href: '/tracks/ai-business-zero-budget/zero-budget-stack/google-analytics-data-thinking', type: 'Lesson' },
    ],
    alsoRead: [
      { label: 'GEO + AI Search Systems track', href: '/tracks/geo-ai-search', note: '— full track (building out)' },
      { label: 'AI Content + Distribution track', href: '/tracks/ai-content-distribution', note: '— content operations at scale' },
    ],
  },
  {
    id: 'student',
    label: 'Student / Career Builder',
    icon: '◇',
    iconColor: 'text-green-400',
    borderColor: 'border-green-500/20',
    bgColor: 'bg-green-500/[0.04]',
    tagColor: 'text-green-400 bg-green-500/10 border-green-500/20',
    description:
      'You are learning AI systems to build skills and career capital. You want practical, verifiable knowledge — not hype. You want to understand how production AI engineering actually works.',
    firstStep: {
      label: 'Start with AI Business Zero Budget, Module 1',
      href: '/tracks/ai-business-zero-budget/zero-budget-stack/choosing-your-product',
    },
    pathway: [
      { label: 'Choosing Your First AI Product', href: '/tracks/ai-business-zero-budget/zero-budget-stack/choosing-your-product', type: 'Lesson' },
      { label: 'Free-Tier Infrastructure Architecture', href: '/tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture', type: 'Lesson' },
      { label: 'GitHub for Non-Developers', href: '/tracks/ai-business-zero-budget/zero-budget-stack/github-for-non-developers', type: 'Lesson' },
      { label: 'Vercel Deployment for Beginners', href: '/tracks/ai-business-zero-budget/zero-budget-stack/vercel-for-beginners', type: 'Lesson' },
      { label: 'Dev Environment Setup', href: '/tracks/claude-code-operator/foundations/dev-environment', type: 'Lesson' },
    ],
    alsoRead: [
      { label: 'Failure Archive', href: '/failures', note: '— understand what production failure looks like' },
      { label: 'Execution Logs', href: '/logs', note: '— see how a real system gets built over time' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Platform sections map
// ─────────────────────────────────────────────────────────────

const PLATFORM_SECTIONS = [
  {
    label: 'Execution Tracks',
    href: '/tracks',
    desc: 'Structured learning pathways — operator, founder, marketer, and engineer routes.',
    accent: 'text-brand-400',
  },
  {
    label: 'Failure Archive',
    href: '/failures',
    desc: 'Production failures documented with exact errors, root causes, and fixes.',
    accent: 'text-red-400',
  },
  {
    label: 'Playbooks',
    href: '/playbooks',
    desc: 'Proven, repeatable operational procedures you can execute immediately.',
    accent: 'text-amber-400',
  },
  {
    label: 'Docs',
    href: '/docs',
    desc: 'Reference documentation grouped by intent — governance, deployment, AI reliability, and more.',
    accent: 'text-emerald-400',
  },
  {
    label: 'Execution Logs',
    href: '/logs',
    desc: 'Dated records of real work sessions — what was built, decided, and why.',
    accent: 'text-cyan-400',
  },
  {
    label: 'Case Studies',
    href: '/case-studies',
    desc: 'Specific engineering problems with full documentation of solutions.',
    accent: 'text-purple-400',
  },
  {
    label: 'Systems Docs',
    href: '/systems',
    desc: 'Reference documentation for production systems that are live.',
    accent: 'text-green-400',
  },
  {
    label: 'Topics',
    href: '/tags',
    desc: 'Browse by topic — firebase, deployment, gemini, observability, and more.',
    accent: 'text-surface-400',
  },
]

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function StartHerePage() {
  const evMetrics = getEvidenceMetrics()

  return (
    <div className="px-5 sm:px-6 lg:px-8 py-8 max-w-4xl">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-10 pb-8 border-b border-white/[0.06]">
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-brand-500/80 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            Start Here
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-surface-50 text-balance leading-[1.2] mb-3">
          Where to Begin
        </h1>

        <p className="text-base text-surface-400 max-w-2xl leading-relaxed">
          AI Execution Lab is a production engineering journal, not a tutorial site. The content is organized around what you actually need to accomplish — not a one-size-fits-all course.
          Find your entry point below.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-surface-600">
          <span>No account required</span>
          <span>·</span>
          <span>Progress saved locally</span>
          <span>·</span>
          <span>Start any lesson immediately</span>
        </div>

        {/* Corpus credibility strip */}
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { value: String(evMetrics.evidenceCount), label: 'evidence pieces' },
            { value: formatOperationalHours(evMetrics), label: 'operational hours documented' },
            { value: `${evMetrics.resolvedCount} resolved`, label: `of ${evMetrics.failureCount} failures` },
            { value: String(evMetrics.totalContentItems), label: 'published items' },
          ].map(item => (
            <div key={item.label} className="flex items-baseline gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
              <span className="text-sm font-bold font-mono text-surface-200">{item.value}</span>
              <span className="text-[10px] text-surface-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── "What do you want to accomplish?" ──────────────── */}
      <div className="mb-12">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-2">
          Quick paths by goal
        </h2>
        <p className="text-xs text-surface-600 mb-6">
          Not sure which track? Pick the goal closest to yours:
        </p>

        <div className="space-y-2">
          {[
            { goal: 'I want to build with Claude Code in production', href: '/tracks/claude-code-operator', label: '→ Claude Code Operator track' },
            { goal: 'I want to launch an AI business with minimal money', href: '/tracks/ai-business-zero-budget', label: '→ AI Business Zero Budget track' },
            { goal: 'I want my content to appear in AI search results', href: '/tracks/geo-ai-search', label: '→ GEO + AI Search track' },
            { goal: 'I want to automate repetitive content operations', href: '/tracks/ai-automation-systems', label: '→ AI Automation Systems track' },
            { goal: 'I want to understand what production AI engineering looks like', href: '/failures', label: '→ Start with the Failure Archive' },
            { goal: 'I want to see how a real AI platform was built', href: '/logs', label: '→ Start with Execution Logs' },
            { goal: 'I have a specific goal — show me a structured execution sequence', href: '/pathways', label: '→ Execution Pathways' },
          ].map(({ goal, href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-lg border border-white/[0.06] px-4 py-3 hover:bg-white/[0.03] hover:border-white/[0.10] transition-all group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-surface-300">{goal}</p>
              </div>
              <span className="text-xs font-mono text-brand-400 shrink-0 group-hover:text-brand-300 transition-colors">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Persona pathways ────────────────────────────────── */}
      <div className="mb-12">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-6">
          Recommended paths by role
        </h2>

        <div className="space-y-6">
          {PERSONAS.map((persona) => (
            <div
              key={persona.id}
              className={`rounded-xl border ${persona.borderColor} ${persona.bgColor} overflow-hidden`}
            >
              {/* Persona header */}
              <div className="px-5 pt-5 pb-4 border-b border-white/[0.04]">
                <div className="flex items-start gap-3">
                  <span className={`text-xl mt-0.5 ${persona.iconColor}`}>{persona.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-surface-100">{persona.label}</h3>
                      <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${persona.tagColor}`}>
                        Role
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 leading-relaxed">{persona.description}</p>
                  </div>
                </div>
              </div>

              {/* First step */}
              <div className="px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-700 mb-1">First step</p>
                <Link
                  href={persona.firstStep.href}
                  className={`text-sm font-medium ${persona.iconColor} hover:opacity-80 transition-opacity`}
                >
                  {persona.firstStep.label} →
                </Link>
              </div>

              {/* Pathway */}
              <div className="px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-700 mb-3">Suggested sequence</p>
                <div className="space-y-1.5">
                  {persona.pathway.map((item, idx) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 text-xs text-surface-400 hover:text-surface-200 transition-colors group"
                    >
                      <span className="font-mono text-surface-700 w-4 shrink-0">{idx + 1}.</span>
                      <span className="flex-1">{item.label}</span>
                      <span className="font-mono text-[9px] text-surface-700 shrink-0 border border-white/[0.06] px-1.5 py-0.5 rounded">
                        {item.type}
                      </span>
                    </Link>
                  ))}
                </div>

                {/* Also read */}
                {persona.alsoRead.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/[0.04]">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-700 mb-2">Also read</p>
                    <div className="space-y-1">
                      {persona.alsoRead.map((item) => (
                        <div key={item.href} className="flex items-baseline gap-1 text-xs">
                          <Link href={item.href} className="text-surface-400 hover:text-surface-200 transition-colors underline underline-offset-2 decoration-white/[0.10] hover:decoration-white/[0.25]">
                            {item.label}
                          </Link>
                          <span className="text-surface-700">{item.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Platform map ────────────────────────────────────── */}
      <div className="mb-12">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-6">
          What's on this platform
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLATFORM_SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-xl border border-white/[0.06] px-4 py-4 hover:bg-white/[0.025] hover:border-white/[0.10] transition-all group"
            >
              <p className={`text-sm font-semibold mb-1 group-hover:opacity-100 transition-opacity ${s.accent}`}>
                {s.label}
              </p>
              <p className="text-xs text-surface-600 leading-relaxed">{s.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Philosophy note ─────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-5 py-5 mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-700 mb-3">
          What makes this different
        </p>
        <div className="space-y-3">
          {[
            {
              title: 'Everything here was built before it was documented',
              desc: 'No content is written for the sake of publishing. Every lesson, playbook, and failure report came from actual production work. The CLAUDE.md lesson describes the actual CLAUDE.md we use. The failure reports are real incidents.',
            },
            {
              title: 'Failures are first-class content',
              desc: 'Most platforms hide failures. The Failure Archive is one of the most-read sections here. Production failure documentation — with exact error messages, root causes, and prevention steps — is educational infrastructure.',
            },
            {
              title: 'No account, no ads, no paywalls',
              desc: 'Everything is free. Progress is saved locally in your browser. You can start any available lesson right now.',
            },
            {
              title: 'Built by A Square Solutions — not for A Square Solutions',
              desc: 'This is a public engineering journal, not a marketing site. The content serves whoever is working on similar systems.',
            },
          ].map(({ title, desc }) => (
            <div key={title} className="flex gap-3">
              <span className="text-brand-500 text-xs mt-0.5 shrink-0">▶</span>
              <div>
                <p className="text-xs font-medium text-surface-300">{title}</p>
                <p className="text-[11px] text-surface-600 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ecosystem links ─────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.04] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-700 mb-3">
          Part of the A Square Solutions ecosystem
        </p>
        <div className="flex flex-wrap gap-4 text-xs">
          <a href="https://asquaresolution.com" target="_blank" rel="noopener noreferrer"
            className="text-surface-500 hover:text-surface-300 transition-colors font-mono">
            asquaresolution.com ↗
          </a>
          <a href="https://trustseal.asquaresolution.com" target="_blank" rel="noopener noreferrer"
            className="text-surface-500 hover:text-surface-300 transition-colors font-mono">
            TrustSeal ↗
          </a>
          <a href="https://scamcheck.asquaresolution.com" target="_blank" rel="noopener noreferrer"
            className="text-surface-500 hover:text-surface-300 transition-colors font-mono">
            ScamCheck ↗
          </a>
        </div>
      </div>

    </div>
  )
}
