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
  {
    id:    'failure:litespeed-client-cache-bypass-ignored',
    type:  'failure',
    title: 'LiteSpeed Cache Ignores Client no-cache Headers',
    href:  '/failures/litespeed-client-cache-bypass-ignored',
    tags:  ['litespeed', 'wordpress', 'caching', 'php-filters', 'wpcode', 'debugging'],
    date:  '2026-05-19',
  },
  {
    id:    'failure:wordpress-hfe-wpautop-injection',
    type:  'failure',
    title: 'WordPress wpautop Injects Paragraph Tags Inside HFE Widget Links',
    href:  '/failures/wordpress-hfe-wpautop-injection',
    tags:  ['wordpress', 'elementor', 'hfe', 'wpautop', 'php-filters', 'wpcode'],
    date:  '2026-05-19',
  },
  {
    id:    'failure:razorpay-test-live-key-mismatch',
    type:  'failure',
    title: 'Razorpay Test/Live Key Mode Mismatch',
    href:  '/failures/razorpay-test-live-key-mismatch',
    tags:  ['razorpay', 'authentication', 'configuration', 'firebase', 'payments'],
    date:  '2026-02-20',
  },
  {
    id:    'failure:firebase-auth-domain-not-authorized',
    type:  'failure',
    title: 'Firebase Auth Session Lost on Custom Domain',
    href:  '/failures/firebase-auth-domain-not-authorized',
    tags:  ['firebase', 'authentication', 'firebase-auth', 'custom-domain', 'session'],
    date:  '2026-03-05',
  },
  {
    id:    'failure:firebase-functions-node-version-stability',
    type:  'failure',
    title: 'Firebase Cloud Functions Crashing on Default Node Runtime',
    href:  '/failures/firebase-functions-node-version-stability',
    tags:  ['firebase', 'firebase-functions', 'node', 'runtime', 'deployment'],
    date:  '2026-02-01',
  },
  {
    id:    'failure:wordpress-sitemap-404',
    type:  'failure',
    title: 'WordPress Sitemap Returns 404 While robots.txt Declares It',
    href:  '/failures/wordpress-sitemap-404',
    tags:  ['wordpress', 'sitemap', 'seo', 'rank-math', 'google-search-console'],
    date:  '2026-05-19',
  },
  {
    id:    'failure:gemini-rate-limit-429-no-ux',
    type:  'failure',
    title: 'Gemini API 429 Rate Limit Returns Hanging Spinner Instead of User Feedback',
    href:  '/failures/gemini-rate-limit-429-no-ux',
    tags:  ['gemini', 'firebase-functions', 'rate-limiting', 'api', 'ux', 'scamcheck'],
    date:  '2026-02-10',
  },
  {
    id:    'failure:ga4-preview-environment-contamination',
    type:  'failure',
    title: 'GA4 Production Analytics Contaminated by Vercel Preview Deployments',
    href:  '/failures/ga4-preview-environment-contamination',
    tags:  ['ga4', 'vercel', 'deployment', 'analytics', 'environment', 'next.js'],
    date:  '2026-03-20',
  },
  {
    id:    'failure:gemini-json-parse-failure',
    type:  'failure',
    title: 'Gemini API Returns Malformed JSON — Cloud Function Parse Failure',
    href:  '/failures/gemini-json-parse-failure',
    tags:  ['gemini', 'firebase-functions', 'structured-output', 'scamcheck', 'trustseal', 'json'],
    date:  '2026-02-15',
  },
  {
    id:    'failure:firebase-deploy-sequence-auth-failure',
    type:  'failure',
    title: 'Firebase Functions 403 After Redeploy — Firestore Rules Deployment Order',
    href:  '/failures/firebase-deploy-sequence-auth-failure',
    tags:  ['firebase', 'firebase-functions', 'firestore', 'deployment', 'authentication', 'trustseal'],
    date:  '2026-05-24',
  },

  // ── Systems ───────────────────────────────────────────────
  {
    id:    'system:trustseal-platform',
    type:  'system',
    title: 'TrustSeal Platform',
    href:  '/systems/trustseal-platform',
    tags:  ['trustseal', 'firebase', 'razorpay', 'github-pages', 'gemini'],
    date:  '2026-03-15',
  },
  {
    id:    'system:scamcheck-platform',
    type:  'system',
    title: 'ScamCheck Platform',
    href:  '/systems/scamcheck-platform',
    tags:  ['scamcheck', 'firebase', 'github-pages', 'gemini'],
    date:  '2026-02-22',
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
  {
    id:    'doc:third-party-api-mode-isolation',
    type:  'doc',
    title: 'Third-Party API Mode Isolation',
    href:  '/docs/third-party-api-mode-isolation',
    tags:  ['razorpay', 'firebase', 'authentication', 'ga4', 'configuration', 'patterns'],
    date:  '2026-05-24',
  },
  {
    id:    'doc:gemini-production-operations',
    type:  'doc',
    title: 'Gemini API: Production Operations Reference',
    href:  '/docs/gemini-production-operations',
    tags:  ['gemini', 'firebase-functions', 'structured-output', 'rate-limiting', 'production'],
    date:  '2026-05-24',
  },
  {
    id:    'doc:ai-output-structure-validation',
    type:  'doc',
    title: 'AI Output Structure Validation',
    href:  '/docs/ai-output-structure-validation',
    tags:  ['gemini', 'ai', 'structured-output', 'patterns', 'production'],
    date:  '2026-05-24',
  },
  {
    id:    'doc:razorpay-subscription-integration',
    type:  'doc',
    title: 'Razorpay Subscription Integration with Firebase',
    href:  '/docs/razorpay-subscription-integration',
    tags:  ['razorpay', 'firebase', 'firebase-functions', 'firestore', 'authentication', 'trustseal'],
    date:  '2026-05-24',
  },
  {
    id:    'doc:firebase-firestore-quota-enforcement',
    type:  'doc',
    title: 'Firestore Quota Enforcement for AI Features',
    href:  '/docs/firebase-firestore-quota-enforcement',
    tags:  ['firestore', 'firebase', 'firebase-functions', 'rate-limiting', 'gemini', 'trustseal', 'scamcheck'],
    date:  '2026-05-24',
  },
  {
    id:    'doc:github-pages-spa-deployment',
    type:  'doc',
    title: 'GitHub Pages SPA Deployment: dist/.git Worktree Pattern',
    href:  '/docs/github-pages-spa-deployment',
    tags:  ['github-pages', 'vite', 'deployment', 'react', 'spa', 'custom-domain', 'trustseal', 'scamcheck'],
    date:  '2026-05-24',
  },
  {
    id:    'doc:operational-invariants',
    type:  'doc',
    title: 'Operational Invariants — A Square Solutions Reliability Doctrine',
    href:  '/docs/operational-invariants',
    tags:  ['reliability', 'deployment', 'firebase', 'gemini', 'razorpay', 'authentication', 'production'],
    date:  '2026-05-25',
  },
  {
    id:    'doc:deployment-verification-checklist',
    type:  'doc',
    title: 'Deployment Verification Checklist — A Square Solutions',
    href:  '/docs/deployment-verification-checklist',
    tags:  ['deployment', 'vercel', 'firebase', 'github-pages', 'wordpress', 'reliability', 'production'],
    date:  '2026-05-25',
  },
  {
    id:    'doc:production-observability-doctrine',
    type:  'doc',
    title: 'Production Observability Doctrine — A Square Solutions',
    href:  '/docs/production-observability-doctrine',
    tags:  ['reliability', 'deployment', 'firebase', 'gemini', 'observability', 'production', 'monitoring'],
    date:  '2026-05-25',
  },
  {
    id:    'doc:ai-cost-governance',
    type:  'doc',
    title: 'AI Cost Governance and Resource Discipline — A Square Solutions',
    href:  '/docs/ai-cost-governance',
    tags:  ['gemini', 'firebase', 'firebase-functions', 'firestore', 'razorpay', 'reliability', 'production', 'rate-limiting'],
    date:  '2026-05-25',
  },
  {
    id:    'doc:operational-security-doctrine',
    type:  'doc',
    title: 'Operational Security Doctrine — A Square Solutions',
    href:  '/docs/operational-security-doctrine',
    tags:  ['firebase', 'firebase-functions', 'firestore', 'razorpay', 'authentication', 'reliability', 'production', 'trustseal', 'scamcheck'],
    date:  '2026-05-25',
  },
  {
    id:    'doc:incident-response-doctrine',
    type:  'doc',
    title: 'Incident Response and Recovery Doctrine — A Square Solutions',
    href:  '/docs/incident-response-doctrine',
    tags:  ['reliability', 'firebase', 'gemini', 'razorpay', 'deployment', 'production', 'trustseal', 'scamcheck'],
    date:  '2026-05-25',
  },
  {
    id:    'doc:operator-decision-doctrine',
    type:  'doc',
    title: 'Operator Decision Doctrine — A Square Solutions',
    href:  '/docs/operator-decision-doctrine',
    tags:  ['reliability', 'deployment', 'firebase', 'production', 'observability'],
    date:  '2026-05-25',
  },
  {
    id:    'doc:release-discipline-doctrine',
    type:  'doc',
    title: 'Release Discipline Doctrine — A Square Solutions',
    href:  '/docs/release-discipline-doctrine',
    tags:  ['reliability', 'deployment', 'firebase', 'production', 'vercel', 'github-pages', 'wordpress'],
    date:  '2026-05-25',
  },
  {
    id:    'doc:operational-onboarding-guide',
    type:  'doc',
    title: 'Operational Onboarding Guide — A Square Solutions',
    href:  '/docs/operational-onboarding-guide',
    tags:  ['reliability', 'deployment', 'firebase', 'production', 'observability', 'trustseal', 'scamcheck'],
    date:  '2026-05-25',
  },
  {
    id:    'playbook:recovery-runbook',
    type:  'playbook',
    title: 'Recovery Runbook — A Square Solutions',
    href:  '/playbooks/recovery-runbook',
    tags:  ['reliability', 'firebase', 'gemini', 'razorpay', 'deployment', 'production', 'trustseal', 'scamcheck'],
    date:  '2026-05-25',
  },
  {
    id:    'playbook:incident-detection-playbook',
    type:  'playbook',
    title: 'Incident Detection Playbook — A Square Solutions',
    href:  '/playbooks/incident-detection-playbook',
    tags:  ['reliability', 'firebase', 'gemini', 'razorpay', 'deployment', 'observability', 'production'],
    date:  '2026-05-25',
  },

  // ── Labs ──────────────────────────────────────────────────
  {
    id:    'lab:gemini-structured-output-reliability',
    type:  'lab',
    title: 'Gemini Structured Output Reliability — Prompt Iteration Experiment',
    href:  '/labs/gemini-structured-output-reliability',
    tags:  ['gemini', 'structured-output', 'firebase-functions', 'scamcheck', 'trustseal', 'experiment'],
    date:  '2026-02-15',
  },
  {
    id:    'lab:quickfix-semantic-html-ai-extraction',
    type:  'lab',
    title: 'QuickFix Component — Semantic HTML for AI Fact Extraction',
    href:  '/labs/quickfix-semantic-html-ai-extraction',
    tags:  ['geo', 'ai-search', 'structured-output', 'experiment', 'seo', 'next.js'],
    date:  '2026-05-18',
  },

  // ── Product Memory Logs ────────────────────────────────────
  {
    id:    'log:2026-05-24-trustseal-product-memory',
    type:  'log',
    title: 'TrustSeal Product Memory — Full Operational Timeline',
    href:  '/logs/2026-05-24-trustseal-product-memory',
    tags:  ['trustseal', 'firebase', 'razorpay', 'deployment'],
    date:  '2026-05-24',
  },
  {
    id:    'log:2026-05-24-scamcheck-product-memory',
    type:  'log',
    title: 'ScamCheck Product Memory — Full Operational Timeline',
    href:  '/logs/2026-05-24-scamcheck-product-memory',
    tags:  ['scamcheck', 'firebase', 'gemini', 'deployment'],
    date:  '2026-05-24',
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

  // WordPress cache + injection failures (2026-05-19)
  { from: 'failure:litespeed-client-cache-bypass-ignored', to: 'pattern:runtime-environment-scope-drift', type: 'exemplifies',  note: 'Client Cache-Control headers are ignored by LiteSpeed — server cache operates outside the client request scope' },
  { from: 'failure:wordpress-hfe-wpautop-injection',       to: 'pattern:dependency-default-changes',      type: 'exemplifies',  note: 'WordPress wpautop() runs on widget render output by default — unexpected output transformation from a silent platform default' },
  { from: 'failure:litespeed-client-cache-bypass-ignored', to: 'failure:wordpress-hfe-wpautop-injection',  type: 'related-to',   note: 'LiteSpeed cache failure discovered while verifying the HFE wpautop fix — sequential failures on the same system in the same session' },
  { from: 'case-study:ecosystem-wordpress-integration',    to: 'failure:litespeed-client-cache-bypass-ignored', type: 'demonstrates', note: 'Ecosystem WordPress integration session surfaced LiteSpeed cache bypass behavior' },
  { from: 'case-study:ecosystem-wordpress-integration',    to: 'failure:wordpress-hfe-wpautop-injection',  type: 'demonstrates', note: 'HFE wpautop injection discovered and resolved during the WordPress integration rollout' },

  // Firebase + Razorpay failures (2026-Q1 TrustSeal build history)
  { from: 'failure:razorpay-test-live-key-mismatch',          to: 'pattern:runtime-environment-scope-drift',   type: 'exemplifies', note: 'Test-mode credentials used alongside live-mode credentials — same root as env var scoping failures' },
  { from: 'failure:firebase-auth-domain-not-authorized',       to: 'pattern:runtime-environment-scope-drift',   type: 'exemplifies', note: 'Works on localhost/test domain, silently fails on custom domain — environment scope mismatch' },
  { from: 'failure:firebase-functions-node-version-stability', to: 'pattern:runtime-environment-scope-drift',   type: 'exemplifies', note: 'Local Node 22 emulator works; Firebase default Node 18 production crashes — environment version mismatch' },
  { from: 'failure:wordpress-sitemap-404',                     to: 'pattern:dependency-default-changes',        type: 'exemplifies', note: 'Plugin or core update flushes rewrite rules — URL handler disappears, silently returning 404' },

  // Cross-failure relationships (linked incidents)
  { from: 'failure:razorpay-test-live-key-mismatch',          to: 'failure:firebase-auth-domain-not-authorized', type: 'related-to', note: 'Same TrustSeal build session — sequential configuration failures on different systems (payments, auth)' },
  { from: 'failure:firebase-auth-domain-not-authorized',       to: 'failure:environment-variable-missing-production', type: 'related-to', note: 'Both are silent configuration failures — system appears functional but key credential/authorization absent in production' },
  { from: 'failure:firebase-functions-node-version-stability', to: 'failure:firebase-auth-domain-not-authorized', type: 'related-to', note: 'Both affected TrustSeal Firebase infrastructure during the same build period' },

  // Case study demonstrates relationships
  { from: 'case-study:trustseal-architecture-build', to: 'failure:razorpay-test-live-key-mismatch',          type: 'demonstrates', note: 'TrustSeal build timeline explicitly documents the Razorpay key mode mismatch on 2026-02-20' },
  { from: 'case-study:trustseal-architecture-build', to: 'failure:firebase-auth-domain-not-authorized',       type: 'demonstrates', note: 'TrustSeal build timeline documents custom domain auth fix on 2026-03-05' },
  { from: 'case-study:trustseal-architecture-build', to: 'failure:firebase-functions-node-version-stability', type: 'demonstrates', note: 'TrustSeal case study notes Node 22 runtime was required for production stability' },

  // WordPress sitemap
  { from: 'case-study:ecosystem-wordpress-integration',  to: 'failure:wordpress-sitemap-404', type: 'related-to', note: 'GSC monitoring established during ecosystem rollout; sitemap 404 discovered in subsequent SEO audit' },

  // Gemini rate limit + ScamCheck
  { from: 'failure:gemini-rate-limit-429-no-ux',          to: 'pattern:runtime-environment-scope-drift', type: 'exemplifies', note: 'Free tier rate limits apply in production but are not triggered in isolated development testing — environment behavior gap' },
  { from: 'failure:gemini-rate-limit-429-no-ux',          to: 'failure:firebase-functions-node-version-stability', type: 'related-to', note: 'Both are Cloud Function execution failures discovered during ScamCheck build — different root causes, same symptom class (function crashes on invocation)' },
  { from: 'case-study:scamcheck-architecture-build',      to: 'failure:gemini-rate-limit-429-no-ux', type: 'demonstrates', note: 'ScamCheck case study documents the 429 rate limit UX failure and fix on 2026-02-10' },
  { from: 'system:scamcheck-platform',                    to: 'failure:gemini-rate-limit-429-no-ux', type: 'related-to', note: 'ScamCheck system doc describes the rate limit handling as a documented operational risk' },

  // GA4 preview contamination
  { from: 'failure:ga4-preview-environment-contamination', to: 'pattern:runtime-environment-scope-drift', type: 'exemplifies', note: 'NEXT_PUBLIC_ variable scoped to all environments — preview deployments get production GA4 ID baked in at build time' },
  { from: 'failure:ga4-preview-environment-contamination', to: 'failure:environment-variable-missing-production', type: 'related-to', note: 'Both are environment variable scoping failures — one causes a missing feature, the other causes data contamination' },
  { from: 'case-study:vercel-deployment-evolution',       to: 'failure:ga4-preview-environment-contamination', type: 'demonstrates', note: 'Vercel deployment evolution case study documents scoping GA4 to Production only as a deployment correctness requirement' },

  // System documents connected to case studies and failures
  { from: 'system:trustseal-platform',   to: 'case-study:trustseal-architecture-build',           type: 'documented-in', note: 'TrustSeal system document is the canonical reference; case study is the build narrative' },
  { from: 'system:trustseal-platform',   to: 'failure:firebase-auth-domain-not-authorized',       type: 'related-to',    note: 'TrustSeal system doc describes Firebase Auth custom domain requirement as a known operational risk' },
  { from: 'system:trustseal-platform',   to: 'failure:razorpay-test-live-key-mismatch',           type: 'related-to',    note: 'TrustSeal system doc describes Razorpay key mode isolation requirement' },
  { from: 'system:trustseal-platform',   to: 'failure:firebase-functions-node-version-stability', type: 'related-to',    note: 'TrustSeal system doc documents explicit Node 22 runtime requirement in firebase.json' },
  { from: 'system:scamcheck-platform',   to: 'case-study:scamcheck-architecture-build',           type: 'documented-in', note: 'ScamCheck system document is the canonical reference; case study is the build narrative' },
  { from: 'system:scamcheck-platform',   to: 'failure:gemini-rate-limit-429-no-ux',               type: 'related-to',    note: 'ScamCheck system doc lists Gemini 429 rate limit as documented operational risk with mitigation in place' },
  { from: 'system:scamcheck-platform',   to: 'failure:firebase-auth-domain-not-authorized',       type: 'related-to',    note: 'ScamCheck required the same Firebase Auth custom domain fix as TrustSeal' },

  // Pattern intelligence docs — connect to all their exemplar failures
  { from: 'doc:third-party-api-mode-isolation', to: 'failure:razorpay-test-live-key-mismatch',          type: 'documented-in', note: 'Razorpay test/live mismatch is Variant 1 of the third-party mode isolation pattern' },
  { from: 'doc:third-party-api-mode-isolation', to: 'failure:firebase-auth-domain-not-authorized',       type: 'documented-in', note: 'Firebase Auth domain authorization is Variant 2 of the pattern' },
  { from: 'doc:third-party-api-mode-isolation', to: 'failure:ga4-preview-environment-contamination',     type: 'documented-in', note: 'GA4 preview contamination is Variant 3 of the pattern' },
  { from: 'doc:third-party-api-mode-isolation', to: 'failure:environment-variable-missing-production',   type: 'documented-in', note: 'Missing production env var is Variant 4 of the pattern' },
  { from: 'doc:third-party-api-mode-isolation', to: 'doc:failure-pattern-library',                       type: 'related-to',    note: 'Dedicated deep-dive on Pattern 3 (Runtime Environment Scope Drift)' },

  // Gemini operations docs — connect to failures and case studies
  { from: 'doc:gemini-production-operations',   to: 'failure:gemini-rate-limit-429-no-ux',               type: 'documented-in', note: 'Rate limit handling section of Gemini ops reference' },
  { from: 'doc:gemini-production-operations',   to: 'failure:firebase-functions-node-version-stability', type: 'documented-in', note: 'Node 22 runtime section of Gemini ops reference' },
  { from: 'doc:gemini-production-operations',   to: 'case-study:scamcheck-architecture-build',           type: 'documented-in', note: 'ScamCheck build is the primary real production evidence for Gemini ops patterns' },
  { from: 'doc:gemini-production-operations',   to: 'case-study:trustseal-architecture-build',           type: 'documented-in', note: 'TrustSeal build is the second production evidence source for Gemini ops patterns' },
  { from: 'doc:ai-output-structure-validation', to: 'failure:gemini-rate-limit-429-no-ux',               type: 'related-to',    note: 'Both docs cover Gemini Cloud Function reliability patterns' },
  { from: 'doc:ai-output-structure-validation', to: 'doc:gemini-production-operations',                  type: 'related-to',    note: 'Complementary docs: gemini-production-operations covers infra; ai-output-structure-validation covers data reliability' },
  { from: 'doc:ai-output-structure-validation', to: 'case-study:scamcheck-architecture-build',           type: 'documented-in', note: 'ScamCheck prompt architecture and JSON parse handling is the primary production evidence' },

  // Product memory logs — connect to systems, case studies, failures
  { from: 'log:2026-05-24-trustseal-product-memory', to: 'system:trustseal-platform',                     type: 'documented-in', note: 'Product memory log consolidates the same events as the system document from timeline perspective' },
  { from: 'log:2026-05-24-trustseal-product-memory', to: 'case-study:trustseal-architecture-build',        type: 'related-to',    note: 'Product memory log traces the same build period; case study is the architectural narrative' },
  { from: 'log:2026-05-24-trustseal-product-memory', to: 'failure:firebase-functions-node-version-stability', type: 'documented-in', note: 'Node 18 crash is Phase 2 event in TrustSeal product timeline' },
  { from: 'log:2026-05-24-trustseal-product-memory', to: 'failure:razorpay-test-live-key-mismatch',         type: 'documented-in', note: 'Razorpay mismatch is Phase 3 event in TrustSeal product timeline' },
  { from: 'log:2026-05-24-trustseal-product-memory', to: 'failure:firebase-auth-domain-not-authorized',    type: 'documented-in', note: 'Auth domain failure is Phase 4 event in TrustSeal product timeline' },
  { from: 'log:2026-05-24-scamcheck-product-memory', to: 'system:scamcheck-platform',                      type: 'documented-in', note: 'Product memory log consolidates the same events as the system document' },
  { from: 'log:2026-05-24-scamcheck-product-memory', to: 'case-study:scamcheck-architecture-build',         type: 'related-to',    note: 'Product memory log traces the same build period; case study is the architectural narrative' },
  { from: 'log:2026-05-24-scamcheck-product-memory', to: 'failure:gemini-rate-limit-429-no-ux',             type: 'documented-in', note: 'Gemini 429 failure is Phase 3 event in ScamCheck product timeline' },
  { from: 'log:2026-05-24-scamcheck-product-memory', to: 'failure:ga4-cross-domain-tracking-gap',           type: 'documented-in', note: 'GA4 cookie_domain failure is Phase 2 event in ScamCheck product timeline' },

  // Gemini JSON parse failure (Phase 3 — new failure report)
  { from: 'failure:gemini-json-parse-failure',          to: 'failure:gemini-rate-limit-429-no-ux',               type: 'related-to',    note: 'Both are Cloud Function Gemini call failure modes — same ScamCheck build context, different root causes (parse vs. rate limit)' },
  { from: 'failure:gemini-json-parse-failure',          to: 'doc:gemini-production-operations',                  type: 'documented-in', note: 'Pre-parse cleaning and structured error return documented in Gemini ops reference' },
  { from: 'failure:gemini-json-parse-failure',          to: 'doc:ai-output-structure-validation',                type: 'documented-in', note: 'JSON parse failure is the primary concrete failure in the AI output structure validation doc' },
  { from: 'case-study:scamcheck-architecture-build',    to: 'failure:gemini-json-parse-failure',                 type: 'demonstrates', note: 'ScamCheck build is the production context where Gemini malformed JSON was first observed and fixed' },
  { from: 'case-study:trustseal-architecture-build',    to: 'failure:gemini-json-parse-failure',                 type: 'demonstrates', note: 'TrustSeal also uses the same Gemini call pattern and pre-parse cleaning fix' },
  { from: 'lab:gemini-structured-output-reliability',   to: 'failure:gemini-json-parse-failure',                 type: 'related-to',    note: 'Lab experiment tests prompt iteration strategy to reduce the parse failure frequency this failure report describes' },
  { from: 'lab:gemini-structured-output-reliability',   to: 'doc:gemini-production-operations',                  type: 'related-to',    note: 'Lab generates the empirical data behind the prompt structure recommendations in Gemini ops doc' },
  { from: 'lab:gemini-structured-output-reliability',   to: 'doc:ai-output-structure-validation',                type: 'related-to',    note: 'Lab experiment provides experimental validation for the 4-layer defensive architecture' },

  // Razorpay subscription integration doc (Phase 3)
  { from: 'doc:razorpay-subscription-integration',      to: 'failure:razorpay-test-live-key-mismatch',           type: 'documented-in', note: 'Mode switch checklist in the Razorpay integration doc directly addresses the test/live mismatch failure' },
  { from: 'doc:razorpay-subscription-integration',      to: 'failure:firebase-functions-node-version-stability', type: 'related-to',    note: 'Node 22 runtime requirement applies to the Razorpay webhook Cloud Function' },
  { from: 'doc:razorpay-subscription-integration',      to: 'system:trustseal-platform',                         type: 'documented-in', note: 'Razorpay integration doc is the detailed implementation reference for TrustSeal payment flow' },
  { from: 'doc:razorpay-subscription-integration',      to: 'doc:firebase-firestore-quota-enforcement',          type: 'related-to',    note: 'Razorpay webhook updates the same Firestore quota document that quota enforcement reads' },
  { from: 'case-study:trustseal-architecture-build',    to: 'doc:razorpay-subscription-integration',             type: 'related-to',    note: 'TrustSeal case study narrative; Razorpay integration doc is the production implementation reference' },

  // Firestore quota enforcement doc (Phase 3)
  { from: 'doc:firebase-firestore-quota-enforcement',   to: 'failure:gemini-rate-limit-429-no-ux',               type: 'related-to',    note: 'Quota enforcement doc covers the pattern of checking quota before calling Gemini to prevent rate limit exhaustion' },
  { from: 'doc:firebase-firestore-quota-enforcement',   to: 'system:trustseal-platform',                         type: 'documented-in', note: 'TrustSeal quota model (10 free checks/month) is the primary production implementation' },
  { from: 'doc:firebase-firestore-quota-enforcement',   to: 'system:scamcheck-platform',                         type: 'related-to',    note: 'ScamCheck quota pattern (unlimited free after sign-up) is the second production evidence case' },
  { from: 'doc:firebase-firestore-quota-enforcement',   to: 'doc:gemini-production-operations',                  type: 'related-to',    note: 'Quota enforcement is the application-layer companion to Gemini rate limit handling' },

  // GitHub Pages SPA deployment doc (Phase 3)
  { from: 'doc:github-pages-spa-deployment',            to: 'failure:vite-github-pages-spa-routing',             type: 'documented-in', note: 'SPA deployment doc explains the 404.html pattern that resolves the Vite GitHub Pages routing failure' },
  { from: 'doc:github-pages-spa-deployment',            to: 'failure:dns-subdomain-propagation-delay',           type: 'related-to',    note: 'DNS propagation section of the deployment doc covers the timing dependencies for custom domain go-live' },
  { from: 'doc:github-pages-spa-deployment',            to: 'system:trustseal-platform',                         type: 'documented-in', note: 'TrustSeal (trustseal.asquaresolution.com) uses this exact deployment pattern in production' },
  { from: 'doc:github-pages-spa-deployment',            to: 'system:scamcheck-platform',                         type: 'documented-in', note: 'ScamCheck (scamcheck.asquaresolution.com) uses this exact deployment pattern in production' },

  // QuickFix lab — semantic HTML AI extraction
  { from: 'lab:quickfix-semantic-html-ai-extraction',   to: 'lab:gemini-structured-output-reliability',          type: 'related-to',    note: 'Both labs test structured content approaches for reliable information extraction — one by AI models calling APIs, one by AI crawlers reading pages' },

  // AI cost governance doc
  { from: 'doc:ai-cost-governance', to: 'doc:firebase-firestore-quota-enforcement',          type: 'related-to',    note: 'Quota enforcement is the primary INV-COST-1 implementation — quota before AI call' },
  { from: 'doc:ai-cost-governance', to: 'doc:gemini-production-operations',                  type: 'related-to',    note: 'Structured logging (INV-COST-3) and rate limit handling are shared with Gemini ops reference' },
  { from: 'doc:ai-cost-governance', to: 'doc:razorpay-subscription-integration',             type: 'related-to',    note: 'Webhook acknowledgement timing (INV-COST-6) and subscription deduplication (INV-COST-5) are in Razorpay integration reference' },
  { from: 'doc:ai-cost-governance', to: 'doc:operational-invariants',                        type: 'related-to',    note: 'INV-AI-1 (quota before AI call) is the reliability framing of INV-COST-1; invariants and cost governance share the same failure evidence base' },
  { from: 'doc:ai-cost-governance', to: 'doc:production-observability-doctrine',             type: 'related-to',    note: 'INV-DET-7 (quota threshold monitoring) is the observability complement to INV-COST-7 (upgrade at 80%)' },
  { from: 'doc:ai-cost-governance', to: 'failure:gemini-rate-limit-429-no-ux',               type: 'documented-in', note: 'Rate limit incident established INV-COST-2 (submit button disabling) and demonstrated daily quota exhaustion risk' },
  { from: 'doc:ai-cost-governance', to: 'failure:gemini-json-parse-failure',                 type: 'documented-in', note: 'Parse failure established INV-COST-3 (no auto-retry on error) — each auto-retry wastes one Gemini call' },
  { from: 'doc:ai-cost-governance', to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'documented-in', note: '14 wasted Cloud Function invocations documented as cost amplification example in deploy failure context' },
  { from: 'doc:ai-cost-governance', to: 'failure:razorpay-test-live-key-mismatch',           type: 'documented-in', note: 'Orphaned subscription creation risk (INV-COST-5) surfaces from this failure — users retry payment creating multiple subscription objects' },
  { from: 'doc:ai-cost-governance', to: 'system:trustseal-platform',                         type: 'related-to',    note: 'TrustSeal is the primary production subject: 10 free checks/month quota model, Gemini + Razorpay cost architecture' },
  { from: 'doc:ai-cost-governance', to: 'system:scamcheck-platform',                         type: 'related-to',    note: 'ScamCheck is the secondary production subject: unlimited free tier, Gemini-only cost architecture' },

  // Production observability doctrine — connects to all failures it defines detection rules for
  { from: 'doc:production-observability-doctrine', to: 'doc:operational-invariants',                        type: 'related-to',    note: 'Observability doctrine is the detection layer; invariants are the reliability layer — they govern the same failure classes' },
  { from: 'doc:production-observability-doctrine', to: 'doc:deployment-verification-checklist',             type: 'related-to',    note: 'Detection doctrine explains why each verification step exists; checklist is the operational execution form' },
  { from: 'doc:production-observability-doctrine', to: 'doc:failure-pattern-library',                       type: 'related-to',    note: 'Detection rules map directly to the failure pattern taxonomy' },
  { from: 'doc:production-observability-doctrine', to: 'playbook:incident-detection-playbook',              type: 'related-to',    note: 'Doctrine defines the detection invariants; playbook is the step-by-step execution for each system' },
  { from: 'doc:production-observability-doctrine', to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'documented-in', note: 'INV-DET-1 (log check within 5 min of deploy) was established by this failure' },
  { from: 'doc:production-observability-doctrine', to: 'failure:firebase-auth-domain-not-authorized',       type: 'documented-in', note: 'INV-DET-2 (auth session persistence test) was established by this failure' },
  { from: 'doc:production-observability-doctrine', to: 'failure:razorpay-test-live-key-mismatch',           type: 'documented-in', note: 'INV-DET-3 (Razorpay delivery log check) was established by this failure' },
  { from: 'doc:production-observability-doctrine', to: 'failure:ga4-preview-environment-contamination',     type: 'documented-in', note: 'INV-DET-4 (GA4 baseline before config change) was established by this failure' },
  { from: 'doc:production-observability-doctrine', to: 'failure:ga4-cross-domain-tracking-gap',             type: 'documented-in', note: 'INV-DET-4 (GA4 session baseline) was established by this failure' },
  { from: 'doc:production-observability-doctrine', to: 'failure:vite-github-pages-spa-routing',             type: 'documented-in', note: 'INV-DET-5 (non-root route navigation test) was established by this failure' },
  { from: 'doc:production-observability-doctrine', to: 'failure:dns-subdomain-propagation-delay',           type: 'documented-in', note: 'INV-DET-6 (external DNS propagation check) was established by this failure' },
  { from: 'doc:production-observability-doctrine', to: 'failure:gemini-rate-limit-429-no-ux',               type: 'documented-in', note: 'INV-DET-7 (quota threshold) and INV-DET-8 (structured error logging) were established by this failure' },
  { from: 'doc:production-observability-doctrine', to: 'failure:gemini-json-parse-failure',                 type: 'documented-in', note: 'INV-DET-8 (structured Gemini call logging) was established by this failure' },

  // Incident detection playbook — resolves failures it covers
  { from: 'playbook:incident-detection-playbook',  to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'resolved-by',   note: 'Playbook System 1 covers Firebase Functions 403 detection procedure' },
  { from: 'playbook:incident-detection-playbook',  to: 'failure:firebase-auth-domain-not-authorized',       type: 'resolved-by',   note: 'Playbook System 1 covers auth session loss detection and resolution' },
  { from: 'playbook:incident-detection-playbook',  to: 'failure:razorpay-test-live-key-mismatch',           type: 'resolved-by',   note: 'Playbook System 1 covers Razorpay webhook delivery detection procedure' },
  { from: 'playbook:incident-detection-playbook',  to: 'failure:gemini-rate-limit-429-no-ux',               type: 'resolved-by',   note: 'Playbook System 2 covers ScamCheck 429 rate limit detection' },
  { from: 'playbook:incident-detection-playbook',  to: 'failure:vite-github-pages-spa-routing',             type: 'resolved-by',   note: 'Playbook System 3 covers non-root route 404 detection and fix' },
  { from: 'playbook:incident-detection-playbook',  to: 'failure:litespeed-client-cache-bypass-ignored',     type: 'resolved-by',   note: 'Playbook System 5 covers LiteSpeed cache detection procedure' },
  { from: 'playbook:incident-detection-playbook',  to: 'failure:wordpress-rest-api-auth-failure',           type: 'resolved-by',   note: 'Playbook System 5 covers WordPress REST API 401 detection and fix' },
  { from: 'playbook:incident-detection-playbook',  to: 'system:trustseal-platform',                         type: 'related-to',    note: 'Playbook System 1 is the operational health procedure for TrustSeal' },
  { from: 'playbook:incident-detection-playbook',  to: 'system:scamcheck-platform',                         type: 'related-to',    note: 'Playbook System 2 is the operational health procedure for ScamCheck' },

  // Operational invariants doc — connects to every failure cluster it synthesizes
  { from: 'doc:operational-invariants', to: 'doc:failure-pattern-library',                       type: 'related-to',    note: 'Invariants are the reliability doctrine extracted from the failure patterns' },
  { from: 'doc:operational-invariants', to: 'doc:third-party-api-mode-isolation',                type: 'related-to',    note: 'ENV cluster invariants (INV-ENV-1 through INV-ENV-3) are the doctrine form of the mode isolation pattern' },
  { from: 'doc:operational-invariants', to: 'doc:gemini-production-operations',                  type: 'related-to',    note: 'AI cluster invariants (INV-AI-1 through INV-AI-5) are formalized from the Gemini ops reference' },
  { from: 'doc:operational-invariants', to: 'doc:razorpay-subscription-integration',             type: 'related-to',    note: 'Payment cluster invariants (INV-PAY-1 through INV-PAY-4) are formalized from the Razorpay integration reference' },
  { from: 'doc:operational-invariants', to: 'doc:firebase-firestore-quota-enforcement',          type: 'related-to',    note: 'INV-AI-1 (quota before AI call) is implemented by the Firestore quota enforcement pattern' },
  { from: 'doc:operational-invariants', to: 'doc:github-pages-spa-deployment',                   type: 'related-to',    note: 'INV-DEP-1 and INV-DEP-2 are formalized from the GitHub Pages deployment reference' },
  { from: 'doc:operational-invariants', to: 'doc:deployment-verification-checklist',             type: 'related-to',    note: 'Verification checklist is the operational companion to the invariants doctrine — what to check to confirm each invariant holds' },
  { from: 'doc:operational-invariants', to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'documented-in', note: 'INV-FB-1 was established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:firebase-functions-node-version-stability', type: 'documented-in', note: 'INV-FB-2 was established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:firebase-auth-domain-not-authorized',       type: 'documented-in', note: 'INV-FB-3 was established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:razorpay-test-live-key-mismatch',           type: 'documented-in', note: 'INV-PAY-2 and INV-ENV-3 were established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:gemini-json-parse-failure',                 type: 'documented-in', note: 'INV-AI-2 and INV-AI-5 were established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:gemini-rate-limit-429-no-ux',               type: 'documented-in', note: 'INV-AI-1 and INV-AI-4 were established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:ga4-preview-environment-contamination',     type: 'documented-in', note: 'INV-ENV-1 was established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:ga4-cross-domain-tracking-gap',             type: 'documented-in', note: 'INV-ENV-2 was established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:dns-subdomain-propagation-delay',           type: 'documented-in', note: 'INV-DEP-1 was established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:vite-github-pages-spa-routing',             type: 'documented-in', note: 'INV-DEP-2 was established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:litespeed-client-cache-bypass-ignored',     type: 'documented-in', note: 'INV-DEP-3 was established by this failure' },
  { from: 'doc:operational-invariants', to: 'failure:wordpress-rest-api-auth-failure',           type: 'documented-in', note: 'INV-DEP-4 was established by this failure' },

  // Deployment verification checklist — connects to everything it cross-checks
  { from: 'doc:deployment-verification-checklist', to: 'doc:operational-invariants',                        type: 'related-to',    note: 'Checklist is the actionable form of the invariants doctrine' },
  { from: 'doc:deployment-verification-checklist', to: 'doc:github-pages-spa-deployment',                   type: 'related-to',    note: 'GitHub Pages section of checklist mirrors the deployment reference procedures' },
  { from: 'doc:deployment-verification-checklist', to: 'doc:razorpay-subscription-integration',             type: 'related-to',    note: 'Payment mode switch checklist derives from Razorpay integration reference' },
  { from: 'doc:deployment-verification-checklist', to: 'doc:third-party-api-mode-isolation',                type: 'related-to',    note: 'Cross-platform credential verification section implements the mode isolation pattern' },
  { from: 'doc:deployment-verification-checklist', to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'prevents',      note: 'Firebase rules-before-functions deploy sequence in checklist prevents this failure' },
  { from: 'doc:deployment-verification-checklist', to: 'failure:firebase-functions-node-version-stability', type: 'prevents',      note: 'nodejs22 pre-deploy check prevents this failure' },
  { from: 'doc:deployment-verification-checklist', to: 'failure:firebase-auth-domain-not-authorized',       type: 'prevents',      note: 'Authorized Domains verification in new project setup checklist prevents this failure' },
  { from: 'doc:deployment-verification-checklist', to: 'failure:razorpay-test-live-key-mismatch',           type: 'prevents',      note: 'Payment mode switch checklist prevents this failure' },
  { from: 'doc:deployment-verification-checklist', to: 'failure:ga4-preview-environment-contamination',     type: 'prevents',      note: 'Analytics ID scoping pre-deploy check prevents this failure' },
  { from: 'doc:deployment-verification-checklist', to: 'failure:dns-subdomain-propagation-delay',           type: 'prevents',      note: 'DNS propagation verification step prevents premature go-live announcement' },
  { from: 'doc:deployment-verification-checklist', to: 'failure:litespeed-client-cache-bypass-ignored',     type: 'prevents',      note: 'LiteSpeed purge step before verification prevents false verification results' },

  // Firebase deploy sequence auth failure (2026-05-24 TrustSeal production incident)
  { from: 'failure:firebase-deploy-sequence-auth-failure', to: 'pattern:infrastructure-timing-dependencies',        type: 'exemplifies',   note: 'Deployment artifact ordering dependency — functions deployed before rules creates an IAM propagation gap. Same pattern class as DNS propagation timing, different artifact type.' },
  { from: 'failure:firebase-deploy-sequence-auth-failure', to: 'failure:firebase-functions-node-version-stability', type: 'related-to',    note: 'Both are Firebase Functions production failures discovered post-deploy — different root causes, both invisible to local emulator testing' },
  { from: 'failure:firebase-deploy-sequence-auth-failure', to: 'failure:firebase-auth-domain-not-authorized',       type: 'related-to',    note: 'Both produce auth failures in Firebase production — domain authorization vs. deploy sequence — both pass local testing' },
  { from: 'failure:firebase-deploy-sequence-auth-failure', to: 'failure:dns-subdomain-propagation-delay',           type: 'related-to',    note: 'Same pattern: infrastructure state has a required ordering/timing that local testing does not enforce' },
  { from: 'system:trustseal-platform',                     to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'related-to',    note: 'TrustSeal production incident — 12 minutes, 14 failed verification requests' },
  { from: 'log:2026-05-24-trustseal-product-memory',       to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'documented-in', note: 'Deploy sequence failure is a post-launch production incident in TrustSeal operational timeline' },
  { from: 'doc:razorpay-subscription-integration',         to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'related-to',    note: 'Razorpay webhook Cloud Function is a deployment artifact subject to the same rules-first deploy requirement' },

  // Operational security doctrine — connects to the failure classes it governs and the docs it synthesizes
  { from: 'doc:operational-security-doctrine', to: 'doc:operational-invariants',                        type: 'related-to',    note: 'Security invariants (INV-SEC-1 through INV-SEC-10) are the security governance layer; operational invariants cover the reliability layer — same failure base, different governance lens' },
  { from: 'doc:operational-security-doctrine', to: 'doc:deployment-verification-checklist',             type: 'related-to',    note: 'Security configuration safety checklist extends the deployment verification checklist with credential and Firestore rules checks' },
  { from: 'doc:operational-security-doctrine', to: 'doc:production-observability-doctrine',             type: 'related-to',    note: 'Silent security drift (5 scenarios) overlaps with absent-signal failure class in the observability doctrine — both require behavioral tests, not log reads' },
  { from: 'doc:operational-security-doctrine', to: 'doc:razorpay-subscription-integration',             type: 'related-to',    note: 'Razorpay webhook HMAC-SHA256 verification (INV-SEC-7) and the dangerous fallback empty-string pattern are documented in both docs' },
  { from: 'doc:operational-security-doctrine', to: 'doc:firebase-firestore-quota-enforcement',          type: 'related-to',    note: 'Firestore Security Rules governance (INV-SEC-3) and the three-tier access model govern the same quota documents' },
  { from: 'doc:operational-security-doctrine', to: 'doc:third-party-api-mode-isolation',                type: 'related-to',    note: 'Credential isolation (INV-SEC-6) is the security framing of the same problem addressed by mode isolation — both prevent credential misuse across environments' },
  { from: 'doc:operational-security-doctrine', to: 'doc:ai-cost-governance',                            type: 'related-to',    note: 'Security and cost governance share the same abuse vector: unauthenticated AI calls bypassing quota enforcement — INV-SEC-2 and INV-COST-1 address the same structural gap' },
  { from: 'doc:operational-security-doctrine', to: 'failure:razorpay-test-live-key-mismatch',           type: 'documented-in', note: 'Credential misclassification (test key used as live key) — documents INV-SEC-6 (separate credential inventories per environment)' },
  { from: 'doc:operational-security-doctrine', to: 'failure:firebase-auth-domain-not-authorized',       type: 'documented-in', note: 'Firebase Auth trust boundary — authorized domains list is an access control configuration that drifts silently; establishes INV-SEC-3 scope' },
  { from: 'doc:operational-security-doctrine', to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'documented-in', note: 'Firestore Security Rules deployment ordering — rules lagging behind functions creates a security window where admin-bypass is the unintended access path; establishes INV-SEC-3 and INV-SEC-4' },
  { from: 'doc:operational-security-doctrine', to: 'failure:environment-variable-missing-production',   type: 'documented-in', note: 'Missing server-only credentials in production is a Tier 1 (server-only) credential absence event — establishes INV-SEC-5 (startup validation)' },
  { from: 'doc:operational-security-doctrine', to: 'failure:firebase-functions-node-version-stability', type: 'related-to',    note: 'Cloud Functions runtime governance intersects with security governance — firebase.json runtime pin (INV-SEC-3 adjacent) prevents admin SDK execution on unsupported runtimes' },
  { from: 'doc:operational-security-doctrine', to: 'system:trustseal-platform',                         type: 'related-to',    note: 'Primary production system: Razorpay webhook (only public HTTP surface), three-tier Firestore access, HMAC verification, four server-only secrets' },
  { from: 'doc:operational-security-doctrine', to: 'system:scamcheck-platform',                         type: 'related-to',    note: 'Secondary production system: callable-only endpoint exposure (no webhook), admin-only Gemini calls, Firebase Auth boundary' },

  // Incident response doctrine — connects to all failures it maps recovery behavior for
  { from: 'doc:incident-response-doctrine', to: 'doc:operational-invariants',                        type: 'related-to',    note: 'Recovery invariants (INV-REC-1 through INV-REC-10) are extracted from the same failure history as the reliability invariants' },
  { from: 'doc:incident-response-doctrine', to: 'doc:production-observability-doctrine',             type: 'related-to',    note: 'Observability doctrine covers detection; incident response doctrine covers recovery — sequential phases of the same incident lifecycle' },
  { from: 'doc:incident-response-doctrine', to: 'doc:deployment-verification-checklist',             type: 'related-to',    note: 'Recovery completion requires running the deployment verification checklist — the same checklist used after forward deploys' },
  { from: 'doc:incident-response-doctrine', to: 'playbook:incident-detection-playbook',              type: 'related-to',    note: 'Detection playbook is the prerequisite; recovery doctrine is the follow-on — together they form the full incident lifecycle' },
  { from: 'doc:incident-response-doctrine', to: 'playbook:recovery-runbook',                         type: 'related-to',    note: 'Doctrine defines the invariants and classification; runbook is the per-system operational execution form' },
  { from: 'doc:incident-response-doctrine', to: 'doc:operational-security-doctrine',                 type: 'related-to',    note: 'Security incidents (credential exposure, rules drift) follow the same blast-radius and fix-forward recovery model' },
  { from: 'doc:incident-response-doctrine', to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'documented-in', note: 'INV-REC-6 (recovery deploy must follow sequencing rules) was established by this failure — recovery under pressure used wrong deploy command' },
  { from: 'doc:incident-response-doctrine', to: 'failure:firebase-auth-domain-not-authorized',       type: 'documented-in', note: 'INV-REC-7 (auth failures require behavioral verification) was established by this failure — logs are silent; only behavioral test confirms recovery' },
  { from: 'doc:incident-response-doctrine', to: 'failure:razorpay-test-live-key-mismatch',           type: 'documented-in', note: 'INV-REC-2 (config before code) and atomic four-credential fix established by this failure' },
  { from: 'doc:incident-response-doctrine', to: 'failure:gemini-rate-limit-429-no-ux',               type: 'documented-in', note: 'INV-REC-8 (quota-exhausted degraded mode preferable to retry) established by this failure' },
  { from: 'doc:incident-response-doctrine', to: 'failure:litespeed-client-cache-bypass-ignored',     type: 'documented-in', note: 'INV-REC-9 (time-bound failures not acceleratable) and cache-purge-before-verify established by this failure' },
  { from: 'doc:incident-response-doctrine', to: 'failure:dns-subdomain-propagation-delay',           type: 'documented-in', note: 'INV-REC-9 (DNS propagation not acceleratable) established by this failure' },
  { from: 'doc:incident-response-doctrine', to: 'failure:ga4-preview-environment-contamination',     type: 'documented-in', note: 'INV-REC-1 (fix-forward: code rollback without env var fix is incomplete) established by this failure' },
  { from: 'doc:incident-response-doctrine', to: 'failure:vite-github-pages-spa-routing',             type: 'documented-in', note: 'P2 blast radius model: root route works, non-root routes broken — SPA routing regression is a partial failure, not total' },
  { from: 'doc:incident-response-doctrine', to: 'failure:firebase-functions-node-version-stability', type: 'documented-in', note: 'P1 recovery: one-line firebase.json change + redeploy is the fastest Firebase P0/P1 recovery path' },
  { from: 'doc:incident-response-doctrine', to: 'system:trustseal-platform',                         type: 'related-to',    note: 'TrustSeal is the primary production subject: Firebase Functions, Razorpay, and auth incidents all originated here' },
  { from: 'doc:incident-response-doctrine', to: 'system:scamcheck-platform',                         type: 'related-to',    note: 'ScamCheck is the secondary production subject: Gemini quota and SPA routing recoveries documented from ScamCheck operational history' },

  // Recovery runbook — resolves every failure class it documents a procedure for
  { from: 'playbook:recovery-runbook', to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'resolved-by',   note: 'Recovery 1 — rules-first redeploy sequence (Step A)' },
  { from: 'playbook:recovery-runbook', to: 'failure:firebase-functions-node-version-stability', type: 'resolved-by',   note: 'Recovery 1 — nodejs22 config fix (Step C)' },
  { from: 'playbook:recovery-runbook', to: 'failure:firebase-auth-domain-not-authorized',       type: 'resolved-by',   note: 'Recovery 2 — Authorized Domains configuration + behavioral verification' },
  { from: 'playbook:recovery-runbook', to: 'failure:gemini-rate-limit-429-no-ux',               type: 'resolved-by',   note: 'Recovery 3 — quota exhaustion degraded mode and per-minute rate limit procedures' },
  { from: 'playbook:recovery-runbook', to: 'failure:razorpay-test-live-key-mismatch',           type: 'resolved-by',   note: 'Recovery 4 — atomic four-credential update procedure (Case A)' },
  { from: 'playbook:recovery-runbook', to: 'failure:vite-github-pages-spa-routing',             type: 'resolved-by',   note: 'Recovery 5 — 404.html and CNAME restoration procedure (Steps A and B)' },
  { from: 'playbook:recovery-runbook', to: 'failure:litespeed-client-cache-bypass-ignored',     type: 'resolved-by',   note: 'Recovery 6 — LiteSpeed Purge All before verification procedure' },
  { from: 'playbook:recovery-runbook', to: 'failure:wordpress-rest-api-auth-failure',           type: 'resolved-by',   note: 'Recovery 7 — Base64 encoding verification and Application Password recovery' },
  { from: 'playbook:recovery-runbook', to: 'failure:ga4-preview-environment-contamination',     type: 'resolved-by',   note: 'Recovery 8 — Vercel env var scope restriction to Production only' },
  { from: 'playbook:recovery-runbook', to: 'failure:ga4-cross-domain-tracking-gap',             type: 'resolved-by',   note: 'Recovery 8 — GA4 cookie_domain cross-subdomain fix' },
  { from: 'playbook:recovery-runbook', to: 'failure:edge-runtime-deployment-failure',           type: 'resolved-by',   note: 'Recovery 9 — server module boundary fix and Vercel redeploy' },
  { from: 'playbook:recovery-runbook', to: 'failure:dns-subdomain-propagation-delay',           type: 'resolved-by',   note: 'Recovery 10 — DNS propagation verification and wait procedure' },
  { from: 'playbook:recovery-runbook', to: 'doc:incident-response-doctrine',                    type: 'related-to',    note: 'Runbook is the per-system execution form of the doctrine — doctrine defines why, runbook defines how' },
  { from: 'playbook:recovery-runbook', to: 'playbook:incident-detection-playbook',              type: 'related-to',    note: 'Detection playbook is the prerequisite to the recovery runbook — detect first, recover second' },
  { from: 'playbook:recovery-runbook', to: 'doc:deployment-verification-checklist',             type: 'related-to',    note: 'Recovery completion checklist references the deployment verification checklist for post-recovery confirmation' },
  { from: 'playbook:recovery-runbook', to: 'system:trustseal-platform',                         type: 'related-to',    note: 'Firebase, Razorpay, and auth recovery procedures are the primary operational procedures for TrustSeal' },
  { from: 'playbook:recovery-runbook', to: 'system:scamcheck-platform',                         type: 'related-to',    note: 'Gemini quota and SPA routing recovery procedures are the primary operational procedures for ScamCheck' },

  // Operator decision doctrine — the human judgment layer; connects to every incident where human decision failure contributed
  { from: 'doc:operator-decision-doctrine', to: 'doc:operational-invariants',                        type: 'related-to',    note: 'Operator invariants (INV-OPS-1 through INV-OPS-10) are the human-judgment layer over the technical reliability invariants' },
  { from: 'doc:operator-decision-doctrine', to: 'doc:incident-response-doctrine',                    type: 'related-to',    note: 'INV-REC invariants govern what to do during incidents; INV-OPS invariants govern how to think and decide during incidents' },
  { from: 'doc:operator-decision-doctrine', to: 'doc:production-observability-doctrine',             type: 'related-to',    note: 'Absent-signal failure class (INV-OPS-6) and misleading signals catalog are extensions of the observability doctrine into human cognition' },
  { from: 'doc:operator-decision-doctrine', to: 'doc:deployment-verification-checklist',             type: 'related-to',    note: 'The deployment checklist operationalizes INV-OPS-3 (verification scope) and INV-OPS-8 (incomplete fixes look complete) — the doctrine explains why each item exists' },
  { from: 'doc:operator-decision-doctrine', to: 'doc:operational-security-doctrine',                 type: 'related-to',    note: 'INV-OPS-9 (name assumptions before deployments) is the human counterpart to security invariants — silent security drift scenarios are all assumption-class failures' },
  { from: 'doc:operator-decision-doctrine', to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'documented-in', note: 'INV-OPS-1 (deploy success ≠ correctness) and INV-OPS-5 (pressure shortcutting) established — combined deploy command under pressure' },
  { from: 'doc:operator-decision-doctrine', to: 'failure:firebase-functions-node-version-stability', type: 'documented-in', note: 'INV-OPS-2 (platform defaults must be audited) established — assumed Firebase default Node runtime was safe' },
  { from: 'doc:operator-decision-doctrine', to: 'failure:firebase-auth-domain-not-authorized',       type: 'documented-in', note: 'INV-OPS-3 (verification scope = user flow) and INV-OPS-6 (absent-signal) established — verified sign-in but not post-reload session' },
  { from: 'doc:operator-decision-doctrine', to: 'failure:razorpay-test-live-key-mismatch',           type: 'documented-in', note: 'INV-OPS-4 (behavioral verification) and INV-OPS-8 (incomplete fix) established — payment UI appeared correct; three credentials still wrong' },
  { from: 'doc:operator-decision-doctrine', to: 'failure:ga4-preview-environment-contamination',     type: 'documented-in', note: 'INV-OPS-9 (assumption deployment) established — assumed preview URLs would not generate real analytics traffic; undetected 6 weeks' },
  { from: 'doc:operator-decision-doctrine', to: 'failure:litespeed-client-cache-bypass-ignored',     type: 'documented-in', note: 'INV-OPS-5 (pressure shortcutting) and INV-OPS-10 (reproduce before fixing) established — verified before purge, reached wrong conclusion' },
  { from: 'doc:operator-decision-doctrine', to: 'failure:vite-github-pages-spa-routing',             type: 'documented-in', note: 'INV-OPS-3 (verification scope) established — verified root route only; non-root route failure undetected until user encounter' },
  { from: 'doc:operator-decision-doctrine', to: 'failure:dns-subdomain-propagation-delay',           type: 'documented-in', note: 'INV-OPS-4 (behavioral verification before announcement) established — local browser propagation accepted as global availability' },
  { from: 'doc:operator-decision-doctrine', to: 'failure:wordpress-rest-api-auth-failure',           type: 'documented-in', note: 'INV-OPS-9 (assumption deployment) and INV-OPS-10 (reproduce before fixing) — assumed URL-encoding was required; reproduction via curl identified the exact encoding difference' },

  // Release discipline doctrine — the change-management layer; connects to every incident where change classification or preflight failure contributed
  { from: 'doc:release-discipline-doctrine', to: 'doc:operational-invariants',                        type: 'related-to',    note: 'Change invariants (INV-CHG-1 through INV-CHG-10) are the change-management layer over the reliability invariants' },
  { from: 'doc:release-discipline-doctrine', to: 'doc:deployment-verification-checklist',             type: 'related-to',    note: 'Deployment checklist is the post-deploy execution form; release doctrine is the pre-deploy classification and preflight discipline' },
  { from: 'doc:release-discipline-doctrine', to: 'doc:operator-decision-doctrine',                    type: 'related-to',    note: 'Release doctrine classifies changes and defines preflight; operator doctrine governs the judgment applied during classification and verification' },
  { from: 'doc:release-discipline-doctrine', to: 'doc:incident-response-doctrine',                    type: 'related-to',    note: 'Incidents are the consequence of classification failures; recovery doctrine governs what happens when release discipline was insufficient' },
  { from: 'doc:release-discipline-doctrine', to: 'doc:failure-pattern-library',                       type: 'related-to',    note: 'The six change classes map directly to the failure pattern taxonomy — each class has a corresponding failure mode in the pattern library' },
  { from: 'doc:release-discipline-doctrine', to: 'doc:github-pages-spa-deployment',                   type: 'related-to',    note: 'INV-CHG-9 (Vite build is destructive on dist/) is the change-management framing of the GitHub Pages deployment reference' },
  { from: 'doc:release-discipline-doctrine', to: 'doc:razorpay-subscription-integration',             type: 'related-to',    note: 'INV-CHG-4 (Razorpay mode switch atomicity) is the change-management framing of the Razorpay integration reference' },
  { from: 'doc:release-discipline-doctrine', to: 'doc:operational-security-doctrine',                 type: 'related-to',    note: 'Class B configuration changes (Auth domains, env vars) are where silent security drift originates — change classification is the first security control' },
  { from: 'doc:release-discipline-doctrine', to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'documented-in', note: 'INV-CHG-3 (Functions + Rules are separate surfaces) — Class D treated as Class C; no sequence defined' },
  { from: 'doc:release-discipline-doctrine', to: 'failure:firebase-functions-node-version-stability', type: 'documented-in', note: 'INV-CHG-2 (platform defaults must be audited) — new project deploy; Node 18 default not audited' },
  { from: 'doc:release-discipline-doctrine', to: 'failure:firebase-auth-domain-not-authorized',       type: 'documented-in', note: 'INV-CHG-6 (new domain is Class D multi-surface) — go-live treated as Class C; Firebase Auth surface omitted' },
  { from: 'doc:release-discipline-doctrine', to: 'failure:razorpay-test-live-key-mismatch',           type: 'documented-in', note: 'INV-CHG-4 (multi-system atomicity) — mode switch treated as credential update; atomicity requirement not defined' },
  { from: 'doc:release-discipline-doctrine', to: 'failure:ga4-preview-environment-contamination',     type: 'documented-in', note: 'INV-CHG-1 (classify before executing) and INV-CHG-2 (config changes are production changes) — env var change treated as dev task' },
  { from: 'doc:release-discipline-doctrine', to: 'failure:next-mdx-remote-v6-blockjs',                type: 'documented-in', note: 'INV-CHG-5 (dependency upgrades are Class F regardless of semver) — minor version bump with silent default behavior change' },
  { from: 'doc:release-discipline-doctrine', to: 'failure:vite-github-pages-spa-routing',             type: 'documented-in', note: 'INV-CHG-9 (Vite build is destructive on dist/) — 404.html and CNAME not in public/; wiped by every build' },
  { from: 'doc:release-discipline-doctrine', to: 'failure:dns-subdomain-propagation-delay',           type: 'documented-in', note: 'Class E (infrastructure — time-bounded propagation) — treated as instant configuration change; go-live on local DNS resolution only' },
  { from: 'doc:release-discipline-doctrine', to: 'failure:litespeed-client-cache-bypass-ignored',     type: 'documented-in', note: 'Class B preflight gap — cache purge not included in verification methodology for PHP filter changes' },
  { from: 'doc:release-discipline-doctrine', to: 'failure:gemini-json-parse-failure',                 type: 'documented-in', note: 'INV-CHG-8 (Gemini changes require adversarial output testing) — parser not tested with malformed Gemini outputs before production' },
  { from: 'doc:release-discipline-doctrine', to: 'system:trustseal-platform',                         type: 'related-to',    note: 'TrustSeal is the primary subject: Firebase combined releases, Razorpay mode switch, domain go-live — the three highest-risk change classes' },
  { from: 'doc:release-discipline-doctrine', to: 'system:scamcheck-platform',                         type: 'related-to',    note: 'ScamCheck is the secondary subject: Vite/GitHub Pages deploys, Gemini prompt changes, DNS domain setup' },

  // Operational onboarding guide — the entry-point document; connects to every doctrine layer it summarizes and navigates to
  { from: 'doc:operational-onboarding-guide', to: 'doc:operational-invariants',                        type: 'related-to',    note: 'Onboarding guide summarizes the ten most critical invariants and links to the full invariants reference' },
  { from: 'doc:operational-onboarding-guide', to: 'doc:deployment-verification-checklist',             type: 'related-to',    note: 'Doctrine navigation map surfaces deployment checklist as the first read before any Zone 2/3 change' },
  { from: 'doc:operational-onboarding-guide', to: 'doc:release-discipline-doctrine',                   type: 'related-to',    note: 'Change classification framework and safe contribution zones reference release discipline directly' },
  { from: 'doc:operational-onboarding-guide', to: 'doc:operator-decision-doctrine',                    type: 'related-to',    note: 'The ten most important operational facts map to INV-OPS invariants; glossary cross-links operator doctrine' },
  { from: 'doc:operational-onboarding-guide', to: 'doc:incident-response-doctrine',                    type: 'related-to',    note: 'When-something-is-wrong quickstart maps to incident classification from incident response doctrine' },
  { from: 'doc:operational-onboarding-guide', to: 'doc:production-observability-doctrine',             type: 'related-to',    note: 'Absent-signal failure orientation (INV-CONT-4) references observability doctrine signal taxonomy' },
  { from: 'doc:operational-onboarding-guide', to: 'doc:operational-security-doctrine',                 type: 'related-to',    note: 'Three-tier access model section is a summary of the security doctrine; Zone 4 contributor zone maps to credential access controls' },
  { from: 'doc:operational-onboarding-guide', to: 'doc:ai-cost-governance',                            type: 'related-to',    note: 'Complete doctrine index includes cost governance; quota economics are referenced in the platform architecture section' },
  { from: 'doc:operational-onboarding-guide', to: 'playbook:incident-detection-playbook',              type: 'related-to',    note: 'Navigation map routes to detection playbook as the first action when something is wrong' },
  { from: 'doc:operational-onboarding-guide', to: 'playbook:recovery-runbook',                         type: 'related-to',    note: 'Navigation map routes to recovery runbook as the second action after blast radius assessment' },
  { from: 'doc:operational-onboarding-guide', to: 'doc:failure-pattern-library',                       type: 'related-to',    note: 'Complete doctrine index includes pattern library; ten critical facts reference pattern-classified failures' },
  { from: 'doc:operational-onboarding-guide', to: 'system:trustseal-platform',                         type: 'related-to',    note: 'TrustSeal is the primary system described in platform architecture and Zone 3 change examples' },
  { from: 'doc:operational-onboarding-guide', to: 'system:scamcheck-platform',                         type: 'related-to',    note: 'ScamCheck is the secondary system described in platform architecture; SPA routing and Gemini facts apply to both' },
  { from: 'doc:operational-onboarding-guide', to: 'failure:firebase-deploy-sequence-auth-failure',     type: 'documented-in', note: 'Critical Fact 1 (combined deploy danger) and INV-CONT-3 (deploy sequence discoverability) established by this failure' },
  { from: 'doc:operational-onboarding-guide', to: 'failure:firebase-functions-node-version-stability', type: 'documented-in', note: 'Critical Fact 2 (Node 22 required) is the onboarding-level summary of this failure' },
  { from: 'doc:operational-onboarding-guide', to: 'failure:firebase-auth-domain-not-authorized',       type: 'documented-in', note: 'Critical Fact 3 (Auth domain authorization) and INV-CONT-4 (absent-signal orientation) established by this failure' },
  { from: 'doc:operational-onboarding-guide', to: 'failure:vite-github-pages-spa-routing',             type: 'documented-in', note: 'Critical Fact 5 (Vite wipes dist/) is the onboarding-level summary of this failure' },
  { from: 'doc:operational-onboarding-guide', to: 'failure:razorpay-test-live-key-mismatch',           type: 'documented-in', note: 'Critical Fact 6 (Razorpay mode isolation) is the onboarding-level summary of this failure' },
  { from: 'doc:operational-onboarding-guide', to: 'failure:gemini-json-parse-failure',                 type: 'documented-in', note: 'Critical Fact 7 (Gemini malformed JSON) is the onboarding-level summary of this failure' },
  { from: 'doc:operational-onboarding-guide', to: 'failure:dns-subdomain-propagation-delay',           type: 'documented-in', note: 'Critical Fact 8 (DNS cannot be accelerated) is the onboarding-level summary of this failure' },
  { from: 'doc:operational-onboarding-guide', to: 'failure:litespeed-client-cache-bypass-ignored',     type: 'documented-in', note: 'Critical Fact 4 (LiteSpeed ignores client cache headers) is the onboarding-level summary of this failure' },
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
