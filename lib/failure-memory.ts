/**
 * lib/failure-memory.ts
 * Failure aggregation, confidence scoring, and pattern coverage analysis.
 *
 * This module answers "how confident are we in this fix?" and "which failure
 * patterns keep recurring?" — elevating the Failure Archive from an incident
 * log to a queryable debugging intelligence layer.
 *
 * Data is static (mirrors frontmatter) to keep this server-safe and build-time
 * compatible. Update when new failures are documented.
 */

import { ENTITIES, RELATIONSHIPS, getFailuresForPattern } from './operational-memory'
import { getAllMeta } from './content'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type RecoveryComplexity = 'trivial' | 'low' | 'moderate' | 'high' | 'expert'
export type FailureSeverity    = 'low' | 'medium' | 'high' | 'critical'

export interface FailureMemoryEntry {
  slug:                string
  title:               string
  href:                string
  date:                string
  severity:            FailureSeverity
  recoveryComplexity:  RecoveryComplexity
  failureType:         string
  tags:                string[]
  /** Pattern IDs this failure exemplifies */
  patterns:            string[]
  /** Number of distinct incidents for this failure root cause */
  instanceCount:       number
  /** Whether structured preventionPatterns[] are documented */
  hasPreventionSteps:  boolean
  /** Whether related lessons are linked */
  hasRelatedLessons:   boolean
  /** Whether a resolver playbook exists */
  hasPlaybook:         boolean
  /** Computed confidence score (0-100) */
  confidenceScore:     number
  /** ISO date of last occurrence */
  lastOccurrence:      string
}

export interface RecurringPattern {
  id:                  string
  name:                string
  /** Failure slugs that are instances of this pattern */
  instances:           string[]
  /** Merged prevention steps from all instances */
  preventionChecklist: string[]
  confidenceScore:     number
  lastOccurrence:      string
}

export interface PatternCoverage {
  patternId:     string
  patternName:   string
  instanceCount: number
  coveragePct:   number   // instances with full documentation / total instances
  confidence:    number   // aggregated confidence across instances
}

export interface DebugPath {
  failureSlug:       string
  failureTitle:      string
  failureHref:       string
  patternId:         string | null
  patternName:       string | null
  confidenceScore:   number
  recoveryComplexity: RecoveryComplexity
  /** Estimated time to resolution if the primary debug path is correct */
  estimatedResolution: string
  verifiedFix:       string
}

// ─────────────────────────────────────────────────────────────
// Failure Memory Table
// Static mirror of frontmatter + FailureIntelligence metadata.
// Update when failures are added or enriched.
// ─────────────────────────────────────────────────────────────

interface RawFailureRecord {
  slug:               string
  title:              string
  date:               string
  severity:           FailureSeverity
  recoveryComplexity: RecoveryComplexity
  failureType:        string
  tags:               string[]
  instanceCount:      number
  hasPreventionSteps: boolean
  hasRelatedLessons:  boolean
  hasPlaybook:        boolean
  verifiedFix:        string
  estimatedResolution: string
}

const RAW_FAILURES: RawFailureRecord[] = [
  {
    slug:               'edge-runtime-deployment-failure',
    title:              'Edge Runtime Deployment Failure',
    date:               '2026-05-10',
    severity:           'high',
    recoveryComplexity: 'moderate',
    failureType:        'deployment',
    tags:               ['vercel', 'edge-runtime', 'deployment', 'next.js'],
    instanceCount:      2,  // platform launch + vercel evolution case study
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        "Replace `export const runtime = 'edge'` with default Node.js runtime on OG image handlers",
    estimatedResolution: '15–25 min',
  },
  {
    slug:               'next-mdx-remote-v6-blockjs',
    title:              'next-mdx-remote v6 blockJS Default Broke MDX Components',
    date:               '2026-05-12',
    severity:           'high',
    recoveryComplexity: 'moderate',
    failureType:        'dependency',
    tags:               ['next-mdx-remote', 'mdx', 'dependency', 'upgrade'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'Add `blockJS: false` to MDXRemote options in content-renderer.tsx',
    estimatedResolution: '20–40 min',
  },
  {
    slug:               'server-module-client-bundle',
    title:              'Node.js fs Module Pulled into Client Bundle',
    date:               '2026-05-14',
    severity:           'high',
    recoveryComplexity: 'moderate',
    failureType:        'build',
    tags:               ['next.js', 'client-bundle', 'fs', 'module-boundary'],
    instanceCount:      2,  // platform launch + vercel evolution case study
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        "Move imports of Node-only modules to server components or API routes; add 'use server' directive",
    estimatedResolution: '15–30 min',
  },
  {
    slug:               'wordpress-rest-api-auth-failure',
    title:              'WordPress REST API Authorization Header Failure',
    date:               '2026-04-20',
    severity:           'medium',
    recoveryComplexity: 'low',
    failureType:        'authentication',
    tags:               ['wordpress', 'authentication', 'base64', 'rest-api'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        true,
    verifiedFix:        'Remove URL-encoding from Application Password before Base64 encoding; use raw password string',
    estimatedResolution: '10–15 min',
  },
  {
    slug:               'vite-github-pages-spa-routing',
    title:              'Vite GitHub Pages SPA Routing 404',
    date:               '2026-03-15',
    severity:           'medium',
    recoveryComplexity: 'low',
    failureType:        'deployment',
    tags:               ['vite', 'github-pages', 'routing', 'spa'],
    instanceCount:      2,  // TrustSeal + ScamCheck both hit this
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'Add 404.html redirect script + history.replaceState in index.html for GitHub Pages SPA routing',
    estimatedResolution: '20–30 min',
  },
  {
    slug:               'dns-subdomain-propagation-delay',
    title:              'DNS Subdomain Propagation Delay',
    date:               '2026-03-20',
    severity:           'medium',
    recoveryComplexity: 'trivial',
    failureType:        'deployment',
    tags:               ['dns', 'deployment', 'subdomain', 'propagation'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'Wait for DNS TTL; use dig or dnschecker.org to monitor propagation; schedule deploys with DNS lead time',
    estimatedResolution: '15 min–48 h (DNS-dependent)',
  },
  {
    slug:               'environment-variable-missing-production',
    title:              'Environment Variable Missing in Production',
    date:               '2026-04-10',
    severity:           'high',
    recoveryComplexity: 'trivial',
    failureType:        'configuration',
    tags:               ['vercel', 'env', 'configuration', 'production'],
    instanceCount:      3,  // platform launch + multiple Vercel deploys
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'In Vercel dashboard: open env variable, ensure Production checkbox is enabled, trigger redeploy',
    estimatedResolution: '5–10 min',
  },
  {
    slug:               'ga4-cross-domain-tracking-gap',
    title:              'GA4 Cross-Domain Tracking Gap',
    date:               '2026-04-05',
    severity:           'medium',
    recoveryComplexity: 'low',
    failureType:        'configuration',
    tags:               ['ga4', 'analytics', 'cross-domain', 'cookie'],
    instanceCount:      2,  // ScamCheck + ecosystem-wordpress-integration
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        "Set cookie_domain to parent domain (.asquaresolutions.com) in GA4 config; add all properties to cross-domain linker list",
    estimatedResolution: '15–20 min',
  },
  {
    slug:               'claude-code-context-exhaustion',
    title:              'Claude Code Context Window Exhaustion Mid-Session',
    date:               '2026-05-18',
    severity:           'medium',
    recoveryComplexity: 'low',
    failureType:        'configuration',
    tags:               ['claude-code', 'context', 'workflow', 'ai-assisted', 'session-management'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'Commit every 45-60 min; log agent task IDs immediately; update MEMORY.md at phase boundaries',
    estimatedResolution: '45 min',
  },
  {
    slug:               'gsc-index-coverage-drop',
    title:              'GSC Index Coverage Drop After Noindex Rollout',
    date:               '2026-05-18',
    severity:           'low',
    recoveryComplexity: 'trivial',
    failureType:        'configuration',
    tags:               ['gsc', 'seo', 'noindex', 'deployment', 'analytics'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'Export excluded URLs from GSC, cross-reference against documented intentional exclusions list; maintain deployment log with noindex decisions',
    estimatedResolution: '25 min',
  },
  {
    slug:               'litespeed-client-cache-bypass-ignored',
    title:              'LiteSpeed Cache Ignores Client no-cache Headers',
    date:               '2026-05-19',
    severity:           'medium',
    recoveryComplexity: 'trivial',
    failureType:        'configuration',
    tags:               ['litespeed', 'wordpress', 'caching', 'php-filters', 'wpcode'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'WordPress Admin → LiteSpeed Cache → Purge All. Client Cache-Control headers do not bypass LiteSpeed server-side cache — Purge All is required after every PHP filter deployment.',
    estimatedResolution: '2 min',
  },
  {
    slug:               'wordpress-hfe-wpautop-injection',
    title:              'WordPress wpautop Injects Paragraph Tags Inside HFE Post-Info Widget Links',
    date:               '2026-05-19',
    severity:           'medium',
    recoveryComplexity: 'low',
    failureType:        'configuration',
    tags:               ['wordpress', 'elementor', 'hfe', 'wpautop', 'php-filters', 'wpcode', 'html'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        "Deploy WPCode snippet hooking elementor/widget/render_content — preg_replace to strip </p><p> injections from hfe-post-info content. Then LiteSpeed Purge All.",
    estimatedResolution: '15–30 min',
  },
  // ── New failures (2026-Q1 operational history) ───────────
  {
    slug:               'razorpay-test-live-key-mismatch',
    title:              'Razorpay Test/Live Key Mode Mismatch',
    date:               '2026-02-20',
    severity:           'high',
    recoveryComplexity: 'trivial',
    failureType:        'configuration',
    tags:               ['razorpay', 'authentication', 'configuration', 'firebase', 'payments'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'Ensure both client-side key (rzp_test_/rzp_live_) and server-side Cloud Function key use the same mode prefix simultaneously',
    estimatedResolution: '10 min',
  },
  {
    slug:               'firebase-auth-domain-not-authorized',
    title:              'Firebase Auth Session Lost on Custom Domain',
    date:               '2026-03-05',
    severity:           'medium',
    recoveryComplexity: 'trivial',
    failureType:        'configuration',
    tags:               ['firebase', 'authentication', 'firebase-auth', 'custom-domain', 'session'],
    instanceCount:      2,  // TrustSeal + ScamCheck both require this fix
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'Firebase Console → Authentication → Settings → Authorized Domains → Add custom domain. No redeploy needed.',
    estimatedResolution: '2 min',
  },
  {
    slug:               'firebase-functions-node-version-stability',
    title:              'Firebase Cloud Functions Crashing on Default Node Runtime',
    date:               '2026-02-01',
    severity:           'high',
    recoveryComplexity: 'low',
    failureType:        'configuration',
    tags:               ['firebase', 'firebase-functions', 'node', 'runtime', 'deployment'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'Set "runtime": "nodejs22" in firebase.json functions config. Update package.json engines field. Redeploy functions.',
    estimatedResolution: '20 min',
  },
  {
    slug:               'wordpress-sitemap-404',
    title:              'WordPress Sitemap Returns 404 While robots.txt Declares It',
    date:               '2026-05-19',
    severity:           'high',
    recoveryComplexity: 'trivial',
    failureType:        'configuration',
    tags:               ['wordpress', 'sitemap', 'seo', 'rank-math', 'google-search-console', 'rewrite-rules'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'WordPress Admin → Settings → Permalinks → Save Changes (flushes and rebuilds rewrite rules without changing permalink structure)',
    estimatedResolution: '5 min',
  },
  // ── New failures (2026-Q1 ScamCheck + Vercel operational history) ──
  {
    slug:               'gemini-rate-limit-429-no-ux',
    title:              'Gemini API 429 Rate Limit Returns Hanging Spinner Instead of User Feedback',
    date:               '2026-02-10',
    severity:           'medium',
    recoveryComplexity: 'low',
    failureType:        'configuration',
    tags:               ['gemini', 'firebase-functions', 'rate-limiting', 'api', 'ux', 'scamcheck'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'Catch 429 in Cloud Function, return { rateLimited: true } as HTTP 200 structured response. Client checks rateLimited flag before verdict path and renders specific retry message.',
    estimatedResolution: '2 hours',
  },
  {
    slug:               'ga4-preview-environment-contamination',
    title:              'GA4 Production Analytics Contaminated by Vercel Preview Deployments',
    date:               '2026-03-20',
    severity:           'low',
    recoveryComplexity: 'trivial',
    failureType:        'configuration',
    tags:               ['ga4', 'vercel', 'deployment', 'analytics', 'environment', 'next.js', 'google-analytics-4'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'In Vercel dashboard → Environment Variables: rescope NEXT_PUBLIC_GA_MEASUREMENT_ID to Production only. Redeploy.',
    estimatedResolution: '30 min',
  },
  {
    slug:               'firebase-deploy-sequence-auth-failure',
    title:              'Firebase Functions 403 After Redeploy — Firestore Rules Deployment Order',
    date:               '2026-05-24',
    severity:           'medium',
    recoveryComplexity: 'low',
    failureType:        'deployment',
    tags:               ['firebase', 'firebase-functions', 'firestore', 'deployment', 'authentication', 'trustseal'],
    instanceCount:      1,
    hasPreventionSteps: true,
    hasRelatedLessons:  false,
    hasPlaybook:        false,
    verifiedFix:        'Deploy Firestore rules before Cloud Functions: firebase deploy --only firestore:rules then firebase deploy --only functions. Never deploy functions first when rules are changing simultaneously.',
    estimatedResolution: '15 min',
  },
]

// ─────────────────────────────────────────────────────────────
// Pattern Prevention Checklists
// Consolidated steps from all failures in each pattern.
// ─────────────────────────────────────────────────────────────

const PATTERN_PREVENTION: Record<string, string[]> = {
  'pattern:module-boundary-violations': [
    "Audit every `export const runtime = 'edge'` — verify it uses only Edge-compatible APIs",
    "Run `next build` and inspect bundle analysis for Node.js-only imports in client components",
    "Add 'use server' to any file that imports fs, path, crypto, or other Node-only modules",
    "Keep OG image handlers on the default Node.js runtime unless Edge is explicitly required",
    "Use `import type` for types from server-only packages in client files",
  ],
  'pattern:dependency-default-changes': [
    "Read the full CHANGELOG for every major dependency version upgrade before merging",
    "Test MDX rendering end-to-end after any next-mdx-remote upgrade",
    "Pin critical content-pipeline dependencies in package.json (no ^ for major versions)",
    "Stage upgrades in a branch with a full content smoke test before merging to main",
  ],
  'pattern:runtime-environment-scope-drift': [
    "After creating a Vercel environment variable, verify Production checkbox is checked",
    "Add all required env vars to .env.example so the deployment checklist can't miss them",
    "Test production environment by running `next start` locally against a .env.production file",
    "Add Vercel deployment verification step: check build logs for undefined variable warnings",
  ],
  'pattern:infrastructure-timing-dependencies': [
    "Schedule DNS changes with at least 24 hours of lead time before a deployment deadline",
    "Monitor propagation with dig or dnschecker.org — don't assume TTL is the actual propagation time",
    "Use Vercel's built-in domain verification to detect HTTPS cert provisioning status",
    "Document expected propagation timelines for each DNS provider in the deployment runbook",
    "When deploying Firebase Functions + Firestore rules together: always deploy rules first (firebase deploy --only firestore:rules), then functions — never use a combined deploy when both artifacts change",
    "Run a real production request immediately after any multi-artifact Firebase deploy to verify auth context is active",
  ],
  'pattern:authentication-encoding-pitfalls': [
    "Use raw Application Passwords directly — never URL-encode before Base64",
    "Validate Authorization header construction with a curl test before wiring into production code",
    "Set GA4 cookie_domain to the parent domain to cover all subdomains from the first deploy",
    "Add all domains to the GA4 cross-domain linker list during initial Analytics setup",
  ],
}

// ─────────────────────────────────────────────────────────────
// Confidence Scoring
// ─────────────────────────────────────────────────────────────

/**
 * Compute confidence score for a single failure (0-100).
 *
 * Scoring rubric:
 *   +30  instanceCount >= 2 (recurring — fix is battle-tested)
 *   +15  instanceCount >= 3
 *   +20  hasPreventionSteps (fix is structured and documented)
 *   +15  hasPlaybook (verified resolution procedure exists)
 *   +10  hasRelatedLessons (fix is cross-referenced to curriculum)
 *   +10  recoveryComplexity is 'trivial' or 'low' (fix is straightforward)
 *   base  20 (all documented failures have at least one confirmed fix)
 */
function computeConfidence(r: RawFailureRecord): number {
  let score = 20
  if (r.instanceCount >= 2)                                                score += 30
  if (r.instanceCount >= 3)                                                score += 15
  if (r.hasPreventionSteps)                                                score += 20
  if (r.hasPlaybook)                                                       score += 15
  if (r.hasRelatedLessons)                                                 score += 10
  if (r.recoveryComplexity === 'trivial' || r.recoveryComplexity === 'low') score += 10
  return Math.min(score, 100)
}

// ─────────────────────────────────────────────────────────────
// Build memoized structures
// Auto-derives hasPlaybook and hasRelatedLessons from frontmatter
// so confidence scores update automatically when content is enriched.
// ─────────────────────────────────────────────────────────────

// Build frontmatter lookup keyed by slug
const _failureFrontmatter = Object.fromEntries(
  getAllMeta('failures').map(m => [m.slug, m.frontmatter])
)

const _failureMemory: FailureMemoryEntry[] = RAW_FAILURES.map(r => {
  const patterns = RELATIONSHIPS
    .filter(rel => rel.from === `failure:${r.slug}` && rel.type === 'exemplifies')
    .map(rel => rel.to)

  const fm = _failureFrontmatter[r.slug]

  // Auto-derive from frontmatter: hasPlaybook = related_playbooks is populated
  const hasPlaybook = r.hasPlaybook ||
    (Array.isArray(fm?.related_playbooks) && fm.related_playbooks.length > 0)

  // Auto-derive from frontmatter: hasRelatedLessons = any cross-section links exist
  const hasRelatedLessons = r.hasRelatedLessons ||
    (Array.isArray(fm?.related_docs)         && fm.related_docs.length > 0) ||
    (Array.isArray(fm?.related_case_studies) && fm.related_case_studies.length > 0) ||
    (Array.isArray(fm?.related_playbooks)    && fm.related_playbooks.length > 0)

  // Auto-derive hasPreventionSteps from frontmatter if not already set
  const hasPreventionSteps = r.hasPreventionSteps

  const enriched: RawFailureRecord = {
    ...r,
    hasPlaybook,
    hasRelatedLessons,
    hasPreventionSteps,
  }

  return {
    slug:               r.slug,
    title:              r.title,
    href:               `/failures/${r.slug}`,
    date:               r.date,
    severity:           r.severity,
    recoveryComplexity: r.recoveryComplexity,
    failureType:        r.failureType,
    tags:               r.tags,
    patterns,
    instanceCount:      r.instanceCount,
    hasPreventionSteps,
    hasRelatedLessons,
    hasPlaybook,
    confidenceScore:    computeConfidence(enriched),
    lastOccurrence:     r.date,
  }
})

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Get the full failure memory table.
 * Each entry is a FailureMemoryEntry with computed confidence score.
 */
export function getFailureMemory(): FailureMemoryEntry[] {
  return _failureMemory
}

/**
 * Get the confidence score for a specific failure (0-100).
 * Returns -1 if the slug is not in the failure memory.
 */
export function getConfidenceScore(slug: string): number {
  return _failureMemory.find(f => f.slug === slug)?.confidenceScore ?? -1
}

/**
 * Get pattern coverage analysis.
 * Returns how well each pattern is documented across its member failures.
 */
export function getPatternCoverage(): PatternCoverage[] {
  const patternEntities = ENTITIES.filter(e => e.type === 'pattern')

  return patternEntities.map(pattern => {
    const members = getFailuresForPattern(pattern.id)
    const memberEntries = members
      .map(e => _failureMemory.find(f => f.slug === e.href.split('/').pop()))
      .filter(Boolean) as FailureMemoryEntry[]

    const fullyDocumented = memberEntries.filter(
      f => f.hasPreventionSteps && f.instanceCount >= 1
    )
    const avgConfidence =
      memberEntries.length > 0
        ? Math.round(
            memberEntries.reduce((sum, f) => sum + f.confidenceScore, 0) / memberEntries.length
          )
        : 0

    return {
      patternId:     pattern.id,
      patternName:   pattern.title,
      instanceCount: members.length,
      coveragePct:   members.length > 0
        ? Math.round((fullyDocumented.length / members.length) * 100)
        : 0,
      confidence:    avgConfidence,
    }
  })
}

/**
 * Get the highest-confidence debugging paths.
 * Returns failures with confidence >= 70, sorted by confidence descending,
 * enriched with pattern context and verified fix.
 */
export function getHighConfidencePaths(): DebugPath[] {
  const rawBySlug = Object.fromEntries(RAW_FAILURES.map(r => [r.slug, r]))

  return _failureMemory
    .filter(f => f.confidenceScore >= 70)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .map(f => {
      const primaryPattern = f.patterns[0] ?? null
      const patternEntity  = primaryPattern
        ? ENTITIES.find(e => e.id === primaryPattern) ?? null
        : null
      const raw = rawBySlug[f.slug]

      return {
        failureSlug:         f.slug,
        failureTitle:        f.title,
        failureHref:         f.href,
        patternId:           primaryPattern,
        patternName:         patternEntity?.title ?? null,
        confidenceScore:     f.confidenceScore,
        recoveryComplexity:  f.recoveryComplexity,
        estimatedResolution: raw?.estimatedResolution ?? 'unknown',
        verifiedFix:         raw?.verifiedFix ?? '',
      }
    })
}

/**
 * Get the consolidated recurring pattern records.
 * Includes merged prevention checklists and aggregate confidence.
 */
export function getRecurringPatterns(): RecurringPattern[] {
  return getPatternCoverage()
    .filter(p => p.instanceCount >= 2)
    .map(p => {
      const members = getFailuresForPattern(p.patternId)
      const memberEntries = members
        .map(e => _failureMemory.find(f => f.slug === e.href.split('/').pop()))
        .filter(Boolean) as FailureMemoryEntry[]

      const lastOccurrence = memberEntries
        .map(f => f.lastOccurrence)
        .sort()
        .reverse()[0] ?? ''

      return {
        id:                  p.patternId,
        name:                p.patternName,
        instances:           members.map(e => e.href.split('/').pop() ?? ''),
        preventionChecklist: PATTERN_PREVENTION[p.patternId] ?? [],
        confidenceScore:     p.confidence,
        lastOccurrence,
      }
    })
}

/**
 * Get a summary of the failure memory system.
 */
export function getFailureMemorySummary(): {
  totalFailures:      number
  avgConfidence:      number
  highConfidence:     number   // failures with score >= 70
  recurringPatterns:  number
  fullyCovered:       number   // failures with hasPreventionSteps + instanceCount >= 1
} {
  const total    = _failureMemory.length
  const avg      = total > 0
    ? Math.round(_failureMemory.reduce((s, f) => s + f.confidenceScore, 0) / total)
    : 0

  return {
    totalFailures:     total,
    avgConfidence:     avg,
    highConfidence:    _failureMemory.filter(f => f.confidenceScore >= 70).length,
    recurringPatterns: getRecurringPatterns().length,
    fullyCovered:      _failureMemory.filter(f => f.hasPreventionSteps).length,
  }
}
