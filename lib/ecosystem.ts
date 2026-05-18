/**
 * lib/ecosystem.ts
 * Static ecosystem deployment state for A Square Solutions.
 * Updated manually when property states change.
 * Used by the ops page for real-time ecosystem observability.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type PropertyStatus = 'live' | 'degraded' | 'maintenance' | 'building'

export interface EcosystemProperty {
  name:         string
  domain:       string
  subdomain:    string | null   // null for the root domain
  platform:     string
  stack:        string[]
  status:       PropertyStatus
  lastDeployed: string          // ISO date (YYYY-MM-DD)
  deployNote:   string          // last meaningful change
  href:         string
  repoSlug?:    string          // GitHub repo if applicable
}

export type DebtPriority = 'p1' | 'p2' | 'p3'
export type DebtArea = 'content' | 'technical' | 'seo' | 'ux' | 'performance'

export interface OperationalDebtItem {
  id:          string
  title:       string
  area:        DebtArea
  priority:    DebtPriority
  description: string
  linkedDoc?:  string   // href to relevant doc or audit entry
  addedDate:   string   // ISO date when debt was identified
}

export type ExperimentStatus = 'active' | 'completed' | 'paused' | 'abandoned'

export interface ActiveExperiment {
  id:         string
  title:      string
  hypothesis: string
  status:     ExperimentStatus
  startDate:  string
  property:   string    // which property/section this is on
  metric:     string    // what we're measuring
  result?:    string    // populated when completed
}

// ─────────────────────────────────────────────────────────────
// Ecosystem Properties
// ─────────────────────────────────────────────────────────────

export const ECOSYSTEM_PROPERTIES: EcosystemProperty[] = [
  {
    name:         'A Square Solutions',
    domain:       'asquaresolution.com',
    subdomain:    null,
    platform:     'WordPress + LiteSpeed',
    stack:        ['WordPress', 'LiteSpeed', 'cPanel', 'GA4'],
    status:       'live',
    lastDeployed: '2026-05-10',
    deployNote:   'Typography repair, ecosystem integration widgets, AEL sidebar',
    href:         'https://asquaresolution.com',
  },
  {
    name:         'AI Execution Lab',
    domain:       'lab.asquaresolution.com',
    subdomain:    'lab',
    platform:     'Vercel',
    stack:        ['Next.js 15', 'TypeScript', 'Tailwind CSS', 'MDX', 'Vercel'],
    status:       'live',
    lastDeployed: '2026-05-18',
    deployNote:   'Platform maturity hardening, lesson progress indicator, noindex hygiene',
    href:         'https://lab.asquaresolution.com',
    repoSlug:     'ai-execution-lab',
  },
  {
    name:         'TrustSeal',
    domain:       'trustseal.asquaresolution.com',
    subdomain:    'trustseal',
    platform:     'GitHub Pages',
    stack:        ['React 18', 'Vite', 'Tailwind CSS', 'Firebase Auth', 'Firestore', 'Razorpay'],
    status:       'live',
    lastDeployed: '2026-04-20',
    deployNote:   'Production launch — Razorpay subscription integration, real-time unlock on payment',
    href:         'https://trustseal.asquaresolution.com',
    repoSlug:     'trustseal',
  },
  {
    name:         'ScamCheck',
    domain:       'scamcheck.asquaresolution.com',
    subdomain:    'scamcheck',
    platform:     'GitHub Pages',
    stack:        ['React 18', 'Vite', 'Plain CSS', 'Firebase Auth', 'Firestore', 'Gemini 1.5 Flash', 'GA4'],
    status:       'live',
    lastDeployed: '2026-04-15',
    deployNote:   'GA4 cross-domain cookie_domain fix, Gemini rate limit handling',
    href:         'https://scamcheck.asquaresolution.com',
    repoSlug:     'scamcheck',
  },
]

// ─────────────────────────────────────────────────────────────
// Operational Debt
// Updated after each audit. Remove items when resolved.
// ─────────────────────────────────────────────────────────────

export const OPERATIONAL_DEBT: OperationalDebtItem[] = [
  {
    id:          'debt-001',
    title:       'Available lesson quality gate audit',
    area:        'content',
    priority:    'p1',
    description: 'Run word count and Checkpoint component check against all available lessons. Any under 900 words with no Checkpoint should revert to coming-soon.',
    linkedDoc:   '/docs/platform-maturity-audit-2026-05',
    addedDate:   '2026-05-18',
  },
  {
    id:          'debt-002',
    title:       'Evidence images: next/image migration',
    area:        'performance',
    priority:    'p1',
    description: '/public/evidence/ images served as raw PNG files. Need Next.js Image component wrapping or remark plugin for WebP conversion and lazy loading.',
    linkedDoc:   '/docs/platform-maturity-audit-2026-05',
    addedDate:   '2026-05-18',
  },
  {
    id:          'debt-003',
    title:       'Tag synonym deduplication',
    area:        'seo',
    priority:    'p2',
    description: 'Tags like "deployment" and "deploy" should be merged. Audit full tag list for synonym duplicates before the tag count grows.',
    addedDate:   '2026-05-18',
  },
  {
    id:          'debt-004',
    title:       'lib/tracks.ts module split',
    area:        'technical',
    priority:    'p2',
    description: 'lib/tracks.ts is ~770 lines. Split into per-track files (tracks/claude-code-operator.ts etc.) imported by a barrel index before it hits 1000+ lines.',
    linkedDoc:   '/docs/platform-maturity-audit-2026-05',
    addedDate:   '2026-05-18',
  },
  {
    id:          'debt-005',
    title:       'Ops page quick links grouping',
    area:        'ux',
    priority:    'p2',
    description: 'Platform Docs section has 13 flat links — hard to scan. Group into: Content, Technical, Intelligence, External.',
    addedDate:   '2026-05-18',
  },
  {
    id:          'debt-006',
    title:       'Start Here page mobile length',
    area:        'ux',
    priority:    'p3',
    description: 'Start Here page is too long on mobile — 3 archetypes with 2-3 sentences + single CTA each would be cleaner.',
    addedDate:   '2026-05-18',
  },
  {
    id:          'debt-007',
    title:       'lib/bookmarks.ts schema version comment',
    area:        'technical',
    priority:    'p3',
    description: 'Add schema version constant to bookmarks so Phase 2 auth migration can detect and migrate old localStorage data format.',
    linkedDoc:   '/docs/platform-maturity-audit-2026-05',
    addedDate:   '2026-05-18',
  },
]

// ─────────────────────────────────────────────────────────────
// Active Experiments
// ─────────────────────────────────────────────────────────────

export const ACTIVE_EXPERIMENTS: ActiveExperiment[] = [
  {
    id:         'exp-001',
    title:      'GEO entity density optimization',
    hypothesis: 'Increasing entity density to ≥3/500 words improves AI search citation rate',
    status:     'active',
    startDate:  '2026-05-18',
    property:   'AI Execution Lab — content',
    metric:     'AI search citation rate (manual 20-query test)',
  },
  {
    id:         'exp-002',
    title:      'Answer-first paragraph structure',
    hypothesis: 'Leading content paragraphs with direct answers increases retrieval chunk independence',
    status:     'active',
    startDate:  '2026-05-18',
    property:   'AI Execution Lab — content',
    metric:     'Answerability score per the geo-intelligence-architecture rubric (target ≥7/10)',
  },
  {
    id:         'exp-003',
    title:      'Failure Archive as trust signal',
    hypothesis: 'Linking failure reports from operational case studies increases session depth on failure pages',
    status:     'active',
    startDate:  '2026-05-14',
    property:   'AI Execution Lab — navigation',
    metric:     'Failure archive page sessions / total sessions ratio',
  },
]

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export function getEcosystemSummary() {
  const live      = ECOSYSTEM_PROPERTIES.filter(p => p.status === 'live').length
  const degraded  = ECOSYSTEM_PROPERTIES.filter(p => p.status === 'degraded').length
  const p1Debt    = OPERATIONAL_DEBT.filter(d => d.priority === 'p1').length
  const activeExp = ACTIVE_EXPERIMENTS.filter(e => e.status === 'active').length
  return { live, degraded, total: ECOSYSTEM_PROPERTIES.length, p1Debt, activeExp }
}
