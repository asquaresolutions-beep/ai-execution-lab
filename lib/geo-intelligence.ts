/**
 * lib/geo-intelligence.ts
 * GEO (Generative Engine Optimization) intelligence layer.
 * Provides entity density analysis, answerability scoring,
 * query taxonomy, and citation opportunity detection.
 *
 * All functions operate on raw content strings and run at build time.
 * No external API calls — pure TypeScript analysis.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type QueryCategory =
  | 'definitional'   // "What is X?"
  | 'procedural'     // "How do I X?"
  | 'diagnostic'     // "Why is X failing?" / "X not working"
  | 'operational'    // "How do I operate X in production?"
  | 'comparative'    // "X vs Y"

export type CitationOpportunity = 'high' | 'medium' | 'low'

export interface GEOQuery {
  query:      string
  category:   QueryCategory
  intent:     string
  difficulty: 'owned' | 'competitive' | 'gap'
  targetSlug?: string  // best-fit content slug if covered
}

export interface EntityDensityResult {
  entityCount:       number
  wordCount:         number
  densityPerHundred: number   // entities per 100 words
  meetsThreshold:    boolean  // threshold: ≥0.6 per 100 words (3 per 500)
  topEntities:       string[]
}

export interface AnswerabilityDimension {
  name:  string
  score: number   // 0, 1, or 2.5
  max:   2.5
  note:  string
}

export interface AnswerabilityResult {
  totalScore:  number   // 0-10
  dimensions:  AnswerabilityDimension[]
  meetsGate:   boolean  // score >= 7.0 for publication
  grade:       'A' | 'B' | 'C' | 'D'
}

export interface ContentGEOReport {
  slug:           string
  entityDensity:  EntityDensityResult
  answerability:  AnswerabilityResult
  citationScore:  number   // 0-10 composite citation potential
  gaps:           string[] // identified improvement areas
}

// ─────────────────────────────────────────────────────────────
// Platform-specific entities (A Square Solutions ecosystem)
// ─────────────────────────────────────────────────────────────

export const PLATFORM_ENTITIES: string[] = [
  // Products
  'AI Execution Lab', 'TrustSeal', 'ScamCheck', 'A Square Solutions',
  // Technologies
  'Next.js', 'Vercel', 'Firebase', 'Firestore', 'Gemini', 'Razorpay',
  'WordPress', 'LiteSpeed', 'GitHub Pages', 'Tailwind CSS', 'TypeScript',
  'Claude Code', 'MDX', 'React', 'Vite', 'GA4',
  // Concepts
  'GEO', 'edge runtime', 'server component', 'client component', 'MDX pipeline',
  'App Router', 'static generation', 'ISR', 'SSG', 'SSR',
  'module boundary', 'blockJS', 'deployment', 'Vercel deployment',
  // Operational
  'failure archive', 'execution track', 'operational evidence', 'case study',
  'publishing velocity', 'content pipeline', 'build time', 'zero-downtime',
]

// ─────────────────────────────────────────────────────────────
// Query Taxonomy
// ─────────────────────────────────────────────────────────────

export const GEO_QUERY_TAXONOMY: GEOQuery[] = [
  // Definitional
  { query: 'what is GEO optimization',                  category: 'definitional', intent: 'Understand what GEO means',                      difficulty: 'competitive' },
  { query: 'what is an AI execution lab',               category: 'definitional', intent: 'Understand the platform concept',                  difficulty: 'owned',       targetSlug: 'platform-vision-architecture' },
  { query: 'what is TrustSeal',                         category: 'definitional', intent: 'Understand TrustSeal product',                     difficulty: 'owned',       targetSlug: 'trustseal-architecture-build' },
  { query: 'what is operational evidence in software',  category: 'definitional', intent: 'Understand evidence-backed publishing',             difficulty: 'owned', targetSlug: 'what-is-operational-evidence' },

  // Procedural
  { query: 'how to deploy Next.js to Vercel',           category: 'procedural',   intent: 'Deploy a Next.js app',                             difficulty: 'competitive' },
  { query: 'how to fix Module not found fs in Next.js', category: 'procedural',   intent: 'Fix server module in client bundle error',         difficulty: 'owned',       targetSlug: 'server-module-client-bundle' },
  { query: 'how to set blockJS false next-mdx-remote',  category: 'procedural',   intent: 'Fix MDX component props being stripped',           difficulty: 'owned',       targetSlug: 'next-mdx-remote-v6-blockjs' },
  { query: 'how to configure GA4 cross-domain tracking',category: 'procedural',   intent: 'Set up cross-domain cookie_domain parameter',      difficulty: 'competitive', targetSlug: 'ga4-cross-domain-tracking-gap' },
  { query: 'how to deploy React Vite to GitHub Pages',  category: 'procedural',   intent: 'Deploy a React Vite SPA to GitHub Pages',         difficulty: 'competitive', targetSlug: 'vite-github-pages-spa-routing' },
  { query: 'how to build AI-assisted publishing system',category: 'procedural',   intent: 'Understand Claude Code content workflow',          difficulty: 'owned',       targetSlug: 'ai-assisted-publishing-system' },

  // Diagnostic
  { query: 'Next.js edge runtime does not support crypto', category: 'diagnostic', intent: 'Fix edge runtime crypto error',                  difficulty: 'owned',       targetSlug: 'edge-runtime-deployment-failure' },
  { query: 'WordPress REST API 401 unauthorized',          category: 'diagnostic', intent: 'Fix WordPress API authentication',               difficulty: 'competitive', targetSlug: 'wordpress-rest-api-auth-failure' },
  { query: 'React Router 404 on page refresh GitHub Pages',category: 'diagnostic', intent: 'Fix SPA routing on static hosts',               difficulty: 'competitive', targetSlug: 'vite-github-pages-spa-routing' },
  { query: 'Vercel env variable not found production',     category: 'diagnostic', intent: 'Fix missing env var in Vercel production',       difficulty: 'competitive', targetSlug: 'environment-variable-missing-production' },
  { query: 'DNS propagation not working subdomain',        category: 'diagnostic', intent: 'Diagnose DNS propagation delays',                difficulty: 'competitive', targetSlug: 'dns-subdomain-propagation-delay' },

  // Operational
  { query: 'operating a Next.js platform on Vercel',           category: 'operational', intent: 'Understand production Vercel operations',    difficulty: 'owned',       targetSlug: 'next-js-vercel-production-operations' },
  { query: 'AI content publishing at scale with Claude',       category: 'operational', intent: 'Understand parallel agent publishing',       difficulty: 'owned',       targetSlug: 'ai-assisted-publishing-system' },
  { query: 'how to structure operational case studies',        category: 'operational', intent: 'Learn case study documentation format',      difficulty: 'owned',       targetSlug: 'how-to-structure-operational-case-studies' },
  { query: 'WordPress ecosystem with SaaS subdomains',         category: 'operational', intent: 'Understand multi-property WordPress setup',  difficulty: 'owned',       targetSlug: 'ecosystem-wordpress-integration' },
  { query: 'how AI engineering teams build production systems',category: 'operational', intent: 'Understand real AI build practice',          difficulty: 'owned',       targetSlug: 'how-we-build' },
  { query: 'cross-property SEO authority linking strategy',    category: 'operational', intent: 'Build authority across multiple domains',    difficulty: 'owned',       targetSlug: 'ecosystem-authority-map' },

  // Definitional — GEO glossary (owned, zero competition)
  { query: 'what is operational SEO',                         category: 'definitional', intent: 'Understand SEO as continuous operations',   difficulty: 'owned',       targetSlug: 'what-is-operational-seo' },
  { query: 'what is execution density in software',           category: 'definitional', intent: 'Understand execution density concept',      difficulty: 'owned',       targetSlug: 'what-is-execution-density' },

  // Comparative
  { query: 'Vercel vs GitHub Pages for React apps',            category: 'comparative', intent: 'Choose deployment platform',                difficulty: 'competitive' },
  { query: 'Firebase vs Supabase for auth',                    category: 'comparative', intent: 'Choose backend for auth',                   difficulty: 'competitive' },
]

// ─────────────────────────────────────────────────────────────
// Entity Density Analysis
// ─────────────────────────────────────────────────────────────

/**
 * Compute entity density for a content string.
 * Counts occurrences of known platform entities.
 * Threshold: ≥3 entities per 500 words (0.6 per 100).
 */
export function computeEntityDensity(
  content: string,
  entities: string[] = PLATFORM_ENTITIES
): EntityDensityResult {
  const wordCount = content.split(/\s+/).filter(Boolean).length
  const contentLower = content.toLowerCase()

  // Count unique entities that appear at least once
  const foundEntities = entities.filter(entity =>
    contentLower.includes(entity.toLowerCase())
  )

  // Count total entity mentions (not unique) for density calculation
  let totalMentions = 0
  const mentionCounts: Record<string, number> = {}
  for (const entity of entities) {
    const regex = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const matches = content.match(regex)
    const count = matches?.length ?? 0
    if (count > 0) {
      mentionCounts[entity] = count
      totalMentions += count
    }
  }

  const densityPerHundred = wordCount > 0
    ? Number(((totalMentions / wordCount) * 100).toFixed(2))
    : 0

  const topEntities = Object.entries(mentionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([entity]) => entity)

  return {
    entityCount:    totalMentions,
    wordCount,
    densityPerHundred,
    meetsThreshold: densityPerHundred >= 0.6,
    topEntities,
  }
}

// ─────────────────────────────────────────────────────────────
// Answerability Scoring
// ─────────────────────────────────────────────────────────────

/**
 * Score content answerability across 4 dimensions (each 0-2.5, total 0-10).
 * Dimensions: direct answer, specificity, actionability, evidence.
 * Publication gate: score ≥ 7.0
 */
export function scoreAnswerability(content: string): AnswerabilityResult {
  const lower = content.toLowerCase()
  const wordCount = content.split(/\s+/).filter(Boolean).length

  // Dimension 1: Direct Answer
  // Proxy: starts with a direct statement, uses "is" / "means" / "refers to" early
  const hasDirectAnswer = /^#[^#].{0,200}(is |means |refers to |allows |enables |provides )/is.test(content)
    || /\n## .{0,50}\n.{0,200}(is |means |refers to )/is.test(content)
  const directAnswerScore: 0 | 1 | 2.5 = hasDirectAnswer ? 2.5 : (wordCount > 500 ? 1 : 0)

  // Dimension 2: Specificity
  // Proxy: contains numbers, version numbers, file paths, specific command names
  const specificitySignals = [
    /\d+\.\d+/,                  // version numbers
    /`[^`]{3,50}`/,              // code references
    /\d+ (minutes|hours|days|seconds|ms|lines|pages)/i,  // measurements
    /(error|warning|failed|success): /i,  // specific output
    /https?:\/\//,               // real URLs
  ]
  const specificityCount = specificitySignals.filter(r => r.test(content)).length
  const specificityScore: 0 | 1 | 2.5 = specificityCount >= 4 ? 2.5 : specificityCount >= 2 ? 1 : 0

  // Dimension 3: Actionability
  // Proxy: contains numbered steps, imperative verbs, "Run", "Add", "Set", code blocks
  const actionabilitySignals = [
    /\d\.\s+(run|add|set|create|install|update|remove|configure|navigate|click)/i,  // numbered steps
    /```[\s\S]{20,}/,            // code blocks
    /^(run|add|set|create|install|update|remove|configure):/im,
    /(step \d|phase \d)/i,
  ]
  const actionabilityCount = actionabilitySignals.filter(r => r.test(content)).length
  const actionabilityScore: 0 | 1 | 2.5 = actionabilityCount >= 3 ? 2.5 : actionabilityCount >= 1 ? 1 : 0

  // Dimension 4: Evidence
  // Proxy: contains commit refs, actual error messages, timing data, screenshot refs
  const evidenceSignals = [
    /commitRef=|commit-ref/i,
    /\d+ minutes|\d+ seconds|\d+ms/i,    // timing evidence
    /Error:|error:|failed with/i,         // actual error messages
    /\/(public|evidence)\//,             // evidence file paths
    /before:.*after:|before\/after/is,   // before/after comparisons
  ]
  const evidenceCount = evidenceSignals.filter(r => r.test(content)).length
  const evidenceScore: 0 | 1 | 2.5 = evidenceCount >= 3 ? 2.5 : evidenceCount >= 1 ? 1 : 0

  const totalScore = directAnswerScore + specificityScore + actionabilityScore + evidenceScore

  const dimensions: AnswerabilityDimension[] = [
    { name: 'Direct Answer',  score: directAnswerScore,  max: 2.5, note: 'Content leads with a direct answer or definition' },
    { name: 'Specificity',    score: specificityScore,   max: 2.5, note: 'Uses specific versions, measurements, file names, commands' },
    { name: 'Actionability',  score: actionabilityScore, max: 2.5, note: 'Includes numbered steps, code blocks, or imperative instructions' },
    { name: 'Evidence',       score: evidenceScore,      max: 2.5, note: 'References actual error messages, timing, commit refs, or screenshots' },
  ]

  const grade: 'A' | 'B' | 'C' | 'D' =
    totalScore >= 9   ? 'A' :
    totalScore >= 7   ? 'B' :
    totalScore >= 5   ? 'C' : 'D'

  return {
    totalScore,
    dimensions,
    meetsGate: totalScore >= 7,
    grade,
  }
}

// ─────────────────────────────────────────────────────────────
// Citation Opportunity Scoring
// ─────────────────────────────────────────────────────────────

/**
 * Score citation potential based on query coverage and content uniqueness.
 * Higher score = more likely to be cited by AI systems.
 */
export function scoreCitationPotential(
  content: string,
  tags: string[],
  slug: string
): number {
  let score = 0

  // Match against query taxonomy
  const coveredQueries = GEO_QUERY_TAXONOMY.filter(q =>
    q.targetSlug === slug ||
    (q.difficulty === 'owned' && tags.some(t => q.query.toLowerCase().includes(t)))
  )
  score += Math.min(coveredQueries.length * 1.5, 4)  // max 4 pts

  // Entity density contribution
  const density = computeEntityDensity(content)
  if (density.meetsThreshold) score += 2
  if (density.entityCount > 20) score += 1

  // Specificity signals: unique operational details = higher citation potential
  if (/\d+ minutes|\d+ seconds/.test(content)) score += 1  // timing data
  if (/```/.test(content)) score += 0.5  // code examples
  if (/commitRef|\/failures\//.test(content)) score += 0.5  // failure archive links
  if (/before.*after|before\/after/i.test(content)) score += 0.5  // comparative data

  return Math.min(Math.round(score * 10) / 10, 10)
}

// ─────────────────────────────────────────────────────────────
// Full Content GEO Report
// ─────────────────────────────────────────────────────────────

/**
 * Generate a complete GEO report for a content item.
 * Combines entity density, answerability, and citation potential.
 */
export function generateGEOReport(
  slug: string,
  content: string,
  tags: string[] = []
): ContentGEOReport {
  const entityDensity = computeEntityDensity(content)
  const answerability = scoreAnswerability(content)
  const citationScore = scoreCitationPotential(content, tags, slug)

  const gaps: string[] = []
  if (!entityDensity.meetsThreshold) {
    gaps.push(`Entity density ${entityDensity.densityPerHundred}/100 words is below 0.6 threshold — add more specific entity references`)
  }
  if (!answerability.meetsGate) {
    const weakDimensions = answerability.dimensions
      .filter(d => d.score < 2.5)
      .map(d => d.name.toLowerCase())
    if (weakDimensions.length > 0) {
      gaps.push(`Weak answerability dimensions: ${weakDimensions.join(', ')}`)
    }
  }
  if (citationScore < 5) {
    gaps.push('Low citation potential — add specific measurements, error messages, or operational outcomes')
  }
  const coveredQueries = GEO_QUERY_TAXONOMY.filter(q => q.targetSlug === slug)
  if (coveredQueries.length === 0) {
    gaps.push('No query taxonomy targets assigned — map this content to likely AI search queries')
  }

  return { slug, entityDensity, answerability, citationScore, gaps }
}

// ─────────────────────────────────────────────────────────────
// Platform-wide query coverage summary
// ─────────────────────────────────────────────────────────────

export function getQueryCoverage(): {
  owned: GEOQuery[]
  competitive: GEOQuery[]
  gaps: GEOQuery[]
  coveragePct: number
} {
  const owned       = GEO_QUERY_TAXONOMY.filter(q => q.difficulty === 'owned')
  const competitive = GEO_QUERY_TAXONOMY.filter(q => q.difficulty === 'competitive')
  const gaps        = GEO_QUERY_TAXONOMY.filter(q => q.difficulty === 'gap')
  const covered     = [...owned, ...competitive].filter(q => q.targetSlug)
  const coveragePct = Math.round((covered.length / GEO_QUERY_TAXONOMY.length) * 100)
  return { owned, competitive, gaps, coveragePct }
}
