/**
 * lib/operational-memory.ts
 * Typed entity relationship graph for the AI Execution Lab operational memory layer.
 *
 * The operational memory system connects all content entities (lessons, failures,
 * playbooks, case studies, logs, docs) through typed relationships — making the
 * platform queryable as debugging intelligence, not just navigable as a documentation site.
 *
 * Entity IDs follow the convention: [type]:[slug]
 * e.g. failure:edge-runtime-deployment-failure, lesson:env-vars-secrets
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type EntityType =
  | 'lesson'
  | 'failure'
  | 'playbook'
  | 'case-study'
  | 'log'
  | 'doc'
  | 'lab'
  | 'system'
  | 'pattern'   // named pattern from failure-pattern-library
  | 'experiment'

export type RelationType =
  | 'prevents'          // entity A being known/completed prevents failure B
  | 'caused-by'         // failure B occurred because entity A was not applied
  | 'demonstrates'      // case-study/log A demonstrates lesson/failure B in practice
  | 'implements'        // lesson A implements the procedure in playbook B
  | 'documented-in'     // failure/experiment A is documented in log/case-study B
  | 'related-to'        // bidirectional operational affinity (no causal direction)
  | 'prerequisite-for'  // lesson A should be understood before lesson B
  | 'escalates-to'      // if failure A is ignored or mishandled, failure B may result
  | 'resolved-by'       // failure A is fixed using the procedure in playbook B
  | 'exemplifies'       // failure A is an instance of pattern B

export interface OperationalEntity {
  id:       string       // [type]:[slug]
  type:     EntityType
  title:    string
  href:     string
  tags?:    string[]
  date?:    string       // ISO date
}

export interface OperationalRelationship {
  from:  string          // entity id
  to:    string          // entity id
  type:  RelationType
  note?: string          // why this relationship exists
}

export interface RelationshipQuery {
  entityId:  string
  relType?:  RelationType
  direction: 'outgoing' | 'incoming' | 'both'
}

export interface DebugContext {
  failureReports:      OperationalEntity[]
  preventionLessons:   OperationalEntity[]
  resolverPlaybooks:   OperationalEntity[]
  relatedPatterns:     OperationalEntity[]
  demonstratingCases:  OperationalEntity[]
}

export interface ExecutionPath {
  steps:         OperationalEntity[]
  estimatedTime: string
  prerequisites: OperationalEntity[]
  caseStudy?:    OperationalEntity
}

// ─────────────────────────────────────────────────────────────
// Entity Registry
// ─────────────────────────────────────────────────────────────

export const ENTITIES: OperationalEntity[] = [
  // ── Failures ──────────────────────────────────────────────
  {
    id:    'failure:edge-runtime-deployment-failure',
    type:  'failure',
    title: 'Edge Runtime Deployment Failure',
    href:  '/failures/edge-runtime-deployment-failure',
    tags:  ['vercel', 'edge-runtime', 'deployment', 'next.js'],
    date:  '2026-05-10',
  },
  {
    id:    'failure:next-mdx-remote-v6-blockjs',
    type:  'failure',
    title: 'next-mdx-remote v6 blockJS Default Broke MDX Components',
    href:  '/failures/next-mdx-remote-v6-blockjs',
    tags:  ['next-mdx-remote', 'mdx', 'dependency', 'upgrade'],
    date:  '2026-05-12',
  },
  {
    id:    'failure:server-module-client-bundle',
    type:  'failure',
    title: 'Node.js fs Module Pulled into Client Bundle',
    href:  '/failures/server-module-client-bundle',
    tags:  ['next.js', 'client-bundle', 'fs', 'module-boundary'],
    date:  '2026-05-14',
  },
  {
    id:    'failure:wordpress-rest-api-auth-failure',
    type:  'failure',
    title: 'WordPress REST API Authorization Header Failure',
    href:  '/failures/wordpress-rest-api-auth-failure',
    tags:  ['wordpress', 'authentication', 'base64', 'rest-api'],
    date:  '2026-04-20',
  },
  {
    id:    'failure:vite-github-pages-spa-routing',
    type:  'failure',
    title: 'Vite GitHub Pages SPA Routing 404',
    href:  '/failures/vite-github-pages-spa-routing',
    tags:  ['vite', 'github-pages', 'routing', 'spa'],
    date:  '2026-03-15',
  },
  {
    id:    'failure:dns-subdomain-propagation-delay',
    type:  'failure',
    title: 'DNS Subdomain Propagation Delay',
    href:  '/failures/dns-subdomain-propagation-delay',
    tags:  ['dns', 'deployment', 'subdomain', 'propagation'],
    date:  '2026-03-20',
  },
  {
    id:    'failure:environment-variable-missing-production',
    type:  'failure',
    title: 'Environment Variable Missing in Production',
    href:  '/failures/environment-variable-missing-production',
    tags:  ['vercel', 'env', 'configuration', 'production'],
    date:  '2026-04-10',
  },
  {
    id:    'failure:ga4-cross-domain-tracking-gap',
    type:  'failure',
    title: 'GA4 Cross-Domain Tracking Gap',
    href:  '/failures/ga4-cross-domain-tracking-gap',
    tags:  ['ga4', 'analytics', 'cross-domain', 'cookie'],
    date:  '2026-04-05',
  },

  {
    id:    'failure:claude-code-context-exhaustion',
    type:  'failure',
    title: 'Claude Code Context Window Exhaustion Mid-Session',
    href:  '/failures/claude-code-context-exhaustion',
    tags:  ['claude-code', 'context', 'workflow', 'ai-assisted', 'session-management'],
    date:  '2026-05-18',
  },
  {
    id:    'failure:gsc-index-coverage-drop',
    type:  'failure',
    title: 'GSC Index Coverage Drop After Noindex Rollout',
    href:  '/failures/gsc-index-coverage-drop',
    tags:  ['gsc', 'seo', 'noindex', 'deployment', 'analytics'],
    date:  '2026-05-18',
  },

  // ── Patterns ──────────────────────────────────────────────
  {
    id:    'pattern:module-boundary-violations',
    type:  'pattern',
    title: 'Module Boundary Violations',
    href:  '/docs/failure-pattern-library#module-boundary-violations',
    tags:  ['next.js', 'module-boundary', 'build'],
  },
  {
    id:    'pattern:dependency-default-changes',
    type:  'pattern',
    title: 'Dependency Default Behavioral Changes',
    href:  '/docs/failure-pattern-library#dependency-default-behavioral-changes',
    tags:  ['dependency', 'upgrade', 'silent-failure'],
  },
  {
    id:    'pattern:runtime-environment-scope-drift',
    type:  'pattern',
    title: 'Runtime Environment Scope Drift',
    href:  '/docs/failure-pattern-library#runtime-environment-scope-drift',
    tags:  ['runtime', 'environment', 'vercel', 'configuration'],
  },
  {
    id:    'pattern:infrastructure-timing-dependencies',
    type:  'pattern',
    title: 'Infrastructure Timing Dependencies',
    href:  '/docs/failure-pattern-library#infrastructure-timing-dependencies',
    tags:  ['dns', 'timing', 'infrastructure'],
  },
  {
    id:    'pattern:authentication-encoding-pitfalls',
    type:  'pattern',
    title: 'Authentication Encoding Pitfalls',
    href:  '/docs/failure-pattern-library#authentication-encoding-pitfalls',
    tags:  ['authentication', 'encoding', 'configuration'],
  },

  // ── Case Studies ──────────────────────────────────────────
  {
    id:    'case-study:ai-execution-lab-platform-launch',
    type:  'case-study',
    title: 'AI Execution Lab — Platform Build and Launch',
    href:  '/case-studies/ai-execution-lab-platform-launch',
    tags:  ['next.js', 'vercel', 'platform', 'mdx'],
    date:  '2026-05-14',
  },
  {
    id:    'case-study:trustseal-architecture-build',
    type:  'case-study',
    title: 'TrustSeal — Architecture and Build',
    href:  '/case-studies/trustseal-architecture-build',
    tags:  ['react', 'firebase', 'razorpay', 'github-pages'],
    date:  '2026-05-14',
  },
  {
    id:    'case-study:scamcheck-architecture-build',
    type:  'case-study',
    title: 'ScamCheck — Architecture and Build',
    href:  '/case-studies/scamcheck-architecture-build',
    tags:  ['react', 'gemini', 'firebase', 'github-pages'],
    date:  '2026-05-14',
  },
  {
    id:    'case-study:vercel-deployment-evolution',
    type:  'case-study',
    title: 'Vercel Deployment Pipeline Evolution',
    href:  '/case-studies/vercel-deployment-evolution',
    tags:  ['vercel', 'deployment', 'next.js', 'build'],
    date:  '2026-05-18',
  },
  {
    id:    'case-study:ecosystem-wordpress-integration',
    type:  'case-study',
    title: 'Ecosystem WordPress Integration',
    href:  '/case-studies/ecosystem-wordpress-integration',
    tags:  ['wordpress', 'ecosystem', 'ga4', 'integration'],
    date:  '2026-05-18',
  },
  {
    id:    'case-study:ai-assisted-publishing-system',
    type:  'case-study',
    title: 'AI-Assisted Publishing System',
    href:  '/case-studies/ai-assisted-publishing-system',
    tags:  ['claude-code', 'mdx', 'publishing', 'automation'],
    date:  '2026-05-18',
  },

  // ── Playbooks ─────────────────────────────────────────────
  {
    id:    'playbook:wp-rest-api-automation-playbook',
    type:  'playbook',
    title: 'WordPress REST API Automation Playbook',
    href:  '/playbooks/wp-rest-api-automation-playbook',
    tags:  ['wordpress', 'rest-api', 'automation'],
    date:  '2026-05-10',
  },

  // ── Docs ──────────────────────────────────────────────────
  {
    id:    'doc:failure-pattern-library',
    type:  'doc',
    title: 'Failure Pattern Library',
    href:  '/docs/failure-pattern-library',
    tags:  ['failures', 'patterns', 'debugging'],
    date:  '2026-05-18',
  },
  {
    id:    'doc:evidence-framework',
    type:  'doc',
    title: 'Evidence Framework',
    href:  '/docs/evidence-framework',
    tags:  ['evidence', 'documentation', 'ops'],
    date:  '2026-05-18',
  },
  {
    id:    'doc:geo-intelligence-architecture',
    type:  'doc',
    title: 'GEO Intelligence Architecture',
    href:  '/docs/geo-intelligence-architecture',
    tags:  ['geo', 'ai-search', 'architecture'],
    date:  '2026-05-18',
  },
  {
    id:    'doc:deployment-workflow',
    type:  'doc',
    title: 'Deployment Workflow',
    href:  '/docs/deployment-workflow',
    tags:  ['deployment', 'vercel', 'workflow'],
  },
]

// ─────────────────────────────────────────────────────────────
// Relationship Graph
// ─────────────────────────────────────────────────────────────

export const RELATIONSHIPS: OperationalRelationship[] = [
  // Module boundary violations pattern
  { from: 'failure:edge-runtime-deployment-failure',  to: 'pattern:module-boundary-violations',    type: 'exemplifies',    note: 'Edge runtime is a client-side runtime restriction — same root as server modules in client bundles' },
  { from: 'failure:server-module-client-bundle',      to: 'pattern:module-boundary-violations',    type: 'exemplifies',    note: 'The canonical module boundary violation' },
  { from: 'failure:edge-runtime-deployment-failure',  to: 'failure:server-module-client-bundle',   type: 'related-to',     note: 'Same root cause: runtime restriction for browser/edge environments' },

  // Dependency default changes pattern
  { from: 'failure:next-mdx-remote-v6-blockjs',       to: 'pattern:dependency-default-changes',    type: 'exemplifies',    note: 'blockJS: true shipped as opt-out default in v6' },

  // Runtime environment scope drift pattern
  { from: 'failure:edge-runtime-deployment-failure',  to: 'pattern:runtime-environment-scope-drift', type: 'exemplifies', note: 'Works in Node.js dev, fails on Vercel edge workers' },
  { from: 'failure:environment-variable-missing-production', to: 'pattern:runtime-environment-scope-drift', type: 'exemplifies', note: 'Vercel env scope checkbox not checked for Production' },

  // Infrastructure timing pattern
  { from: 'failure:dns-subdomain-propagation-delay',  to: 'pattern:infrastructure-timing-dependencies', type: 'exemplifies', note: 'DNS TTL + HTTPS cert provisioning chained timing' },

  // Authentication encoding pattern
  { from: 'failure:wordpress-rest-api-auth-failure',  to: 'pattern:authentication-encoding-pitfalls', type: 'exemplifies', note: 'URL-encoding spaces in Application Password before Base64' },
  { from: 'failure:ga4-cross-domain-tracking-gap',   to: 'pattern:authentication-encoding-pitfalls', type: 'exemplifies', note: 'Silent configuration failure from missing cookie_domain' },

  // Case studies demonstrate failures
  { from: 'case-study:ai-execution-lab-platform-launch', to: 'failure:edge-runtime-deployment-failure',  type: 'demonstrates', note: '23-minute blocked deployment documented in platform launch case study' },
  { from: 'case-study:ai-execution-lab-platform-launch', to: 'failure:next-mdx-remote-v6-blockjs',       type: 'demonstrates', note: '41-minute silent failure documented in platform launch case study' },
  { from: 'case-study:ai-execution-lab-platform-launch', to: 'failure:server-module-client-bundle',      type: 'demonstrates', note: '18-minute build failure documented in platform launch case study' },
  { from: 'case-study:vercel-deployment-evolution',      to: 'failure:edge-runtime-deployment-failure',  type: 'demonstrates', note: 'Deployment evolution case study covers the edge runtime incident in detail' },
  { from: 'case-study:vercel-deployment-evolution',      to: 'failure:next-mdx-remote-v6-blockjs',       type: 'demonstrates', note: 'Deployment evolution traces the blockJS v6 silent failure' },
  { from: 'case-study:scamcheck-architecture-build',     to: 'failure:vite-github-pages-spa-routing',    type: 'demonstrates', note: 'ScamCheck hit the 404 SPA routing issue on GitHub Pages' },
  { from: 'case-study:scamcheck-architecture-build',     to: 'failure:ga4-cross-domain-tracking-gap',    type: 'demonstrates', note: 'ScamCheck needed the cross-domain cookie_domain fix' },
  { from: 'case-study:trustseal-architecture-build',     to: 'failure:vite-github-pages-spa-routing',    type: 'demonstrates', note: 'TrustSeal encountered the SPA routing 404 on GitHub Pages' },
  { from: 'case-study:ecosystem-wordpress-integration',  to: 'failure:ga4-cross-domain-tracking-gap',    type: 'demonstrates', note: 'Ecosystem integration required solving cross-domain GA4 configuration' },

  // Playbooks resolve failures
  { from: 'failure:wordpress-rest-api-auth-failure',  to: 'playbook:wp-rest-api-automation-playbook', type: 'resolved-by', note: 'WP REST API playbook documents correct Authorization header construction' },

  // Docs document pattern libraries
  { from: 'failure:edge-runtime-deployment-failure',  to: 'doc:failure-pattern-library', type: 'documented-in', note: 'Module Boundary Violations pattern in the pattern library' },
  { from: 'failure:server-module-client-bundle',      to: 'doc:failure-pattern-library', type: 'documented-in', note: 'Module Boundary Violations pattern in the pattern library' },
  { from: 'failure:next-mdx-remote-v6-blockjs',      to: 'doc:failure-pattern-library', type: 'documented-in', note: 'Dependency Default Behavioral Changes pattern' },
  { from: 'failure:environment-variable-missing-production', to: 'doc:failure-pattern-library', type: 'documented-in', note: 'Runtime Environment Scope Drift pattern' },
  { from: 'failure:dns-subdomain-propagation-delay', to: 'doc:failure-pattern-library', type: 'documented-in', note: 'Infrastructure Timing Dependencies pattern' },
  { from: 'failure:wordpress-rest-api-auth-failure', to: 'doc:failure-pattern-library', type: 'documented-in', note: 'Authentication Encoding Pitfalls pattern' },
  { from: 'failure:ga4-cross-domain-tracking-gap',   to: 'doc:failure-pattern-library', type: 'documented-in', note: 'Authentication Encoding Pitfalls pattern' },

  // Evidence framework
  { from: 'case-study:ai-execution-lab-platform-launch', to: 'doc:evidence-framework', type: 'related-to', note: 'Platform launch established the evidence collection patterns' },
  { from: 'case-study:ai-assisted-publishing-system',    to: 'doc:evidence-framework', type: 'related-to', note: 'Publishing system describes evidence-first publishing standard' },
]

// ─────────────────────────────────────────────────────────────
// Query Functions
// ─────────────────────────────────────────────────────────────

const entityById = new Map(ENTITIES.map(e => [e.id, e]))

/** Get an entity by its ID */
export function getEntityById(id: string): OperationalEntity | null {
  return entityById.get(id) ?? null
}

/** Get all relationships matching the query */
export function queryRelationships(q: RelationshipQuery): OperationalRelationship[] {
  return RELATIONSHIPS.filter(r => {
    const matchFrom = r.from === q.entityId
    const matchTo   = r.to   === q.entityId
    const matchType = !q.relType || r.type === q.relType

    if (q.direction === 'outgoing') return matchFrom && matchType
    if (q.direction === 'incoming') return matchTo   && matchType
    return (matchFrom || matchTo) && matchType
  })
}

/** Get all entities related to a given entity, optionally filtered by relation type */
export function getRelatedEntities(
  entityId: string,
  relType?: RelationType,
  direction: 'outgoing' | 'incoming' | 'both' = 'both'
): OperationalEntity[] {
  const rels = queryRelationships({ entityId, relType, direction })
  const relatedIds = rels.map(r => r.from === entityId ? r.to : r.from)
  return relatedIds.map(id => entityById.get(id)).filter(Boolean) as OperationalEntity[]
}

/**
 * Build a debug context for a failure entity.
 * Returns the lessons that prevent it, playbooks that resolve it,
 * patterns it exemplifies, and case studies that demonstrate it.
 */
export function getDebugContext(failureId: string): DebugContext {
  return {
    failureReports:     [getEntityById(failureId)].filter(Boolean) as OperationalEntity[],
    preventionLessons:  getRelatedEntities(failureId, 'prevents',     'incoming'),
    resolverPlaybooks:  getRelatedEntities(failureId, 'resolved-by',  'outgoing'),
    relatedPatterns:    getRelatedEntities(failureId, 'exemplifies',  'outgoing'),
    demonstratingCases: getRelatedEntities(failureId, 'demonstrates', 'incoming'),
  }
}

/**
 * Get all failures that exemplify a given pattern.
 */
export function getFailuresForPattern(patternId: string): OperationalEntity[] {
  return getRelatedEntities(patternId, 'exemplifies', 'incoming')
}

/**
 * Get all relationships for a content slug (regardless of entity type).
 * Useful for rendering relationship panels on any content page.
 */
export function getEntityRelationshipsForSlug(
  slug: string,
  type: EntityType
): { entity: OperationalEntity; relationships: OperationalRelationship[] } | null {
  const id     = `${type}:${slug}`
  const entity = entityById.get(id)
  if (!entity) return null
  const relationships = queryRelationships({ entityId: id, direction: 'both' })
  return { entity, relationships }
}

/**
 * Get the execution dependency chain for a lesson:
 * what failures have occurred because this lesson was unknown,
 * and what case studies demonstrate the full arc.
 */
export function getLessonImpactChain(lessonId: string): {
  preventsFailures:    OperationalEntity[]
  demonstratingCases:  OperationalEntity[]
  prerequisites:       OperationalEntity[]
} {
  return {
    preventsFailures:   getRelatedEntities(lessonId, 'prevents',       'outgoing'),
    demonstratingCases: getRelatedEntities(lessonId, 'demonstrates',   'incoming'),
    prerequisites:      getRelatedEntities(lessonId, 'prerequisite-for', 'incoming'),
  }
}

/**
 * Get a summary of the full operational memory graph.
 */
export function getMemoryGraphSummary(): {
  entityCount:       number
  relationshipCount: number
  entityBreakdown:   Record<EntityType, number>
  relationBreakdown: Record<RelationType, number>
} {
  const entityBreakdown = {} as Record<EntityType, number>
  const relationBreakdown = {} as Record<RelationType, number>

  for (const e of ENTITIES) {
    entityBreakdown[e.type] = (entityBreakdown[e.type] ?? 0) + 1
  }
  for (const r of RELATIONSHIPS) {
    relationBreakdown[r.type] = (relationBreakdown[r.type] ?? 0) + 1
  }

  return {
    entityCount:       ENTITIES.length,
    relationshipCount: RELATIONSHIPS.length,
    entityBreakdown,
    relationBreakdown,
  }
}
