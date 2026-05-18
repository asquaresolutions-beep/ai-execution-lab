/**
 * lib/execution-pathways.ts
 * Structured execution pathways — goal-oriented sequences through the platform.
 *
 * Pathways connect existing content (failures, lessons, playbooks, case studies, docs)
 * into opinionated sequences for specific outcomes. Each pathway has a target outcome,
 * a difficulty level, and an ordered list of steps with entity cross-references.
 *
 * Pathways are static and build-time safe.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type PathwayDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type PathwayCategory =
  | 'deployment'
  | 'debugging'
  | 'geo'
  | 'ai-business'
  | 'platform-ops'

export type PathwayStepType =
  | 'lesson'
  | 'failure'
  | 'playbook'
  | 'case-study'
  | 'doc'
  | 'action'    // non-content step (external task, decision point)

export interface PathwayStep {
  id:          string
  title:       string
  type:        PathwayStepType
  href?:       string
  duration:    string
  description: string
  isOptional?: boolean
  /** Slug of the evidence entity that validates this step */
  evidenceRef?: string
}

export interface ExecutionPathway {
  id:            string
  title:         string
  description:   string
  targetOutcome: string
  estimatedTime: string
  difficulty:    PathwayDifficulty
  category:      PathwayCategory
  steps:         PathwayStep[]
  prerequisites: string[]
  outcomes:      string[]
  /** Case study slug that demonstrates the full pathway in practice */
  caseStudyRef?: string
}

// ─────────────────────────────────────────────────────────────
// Pathway Registry
// ─────────────────────────────────────────────────────────────

export const EXECUTION_PATHWAYS: ExecutionPathway[] = [

  // ── 1. Deployment Readiness ────────────────────────────────
  {
    id:            'deployment-readiness',
    title:         'Production Deployment Readiness',
    description:   'Avoid the three most common deployment failures and ship a stable Vercel production environment on the first attempt.',
    targetOutcome: 'A clean first Vercel deployment with correct environment configuration, runtime boundaries, and dependency verification.',
    estimatedTime: '2–3 h',
    difficulty:    'intermediate',
    category:      'deployment',
    prerequisites: ['Basic Next.js knowledge', 'Vercel account'],
    caseStudyRef:  'vercel-deployment-evolution',
    outcomes: [
      'Zero edge runtime surprises on first deploy',
      'All env vars scoped to Production before deploy',
      'Clean next build with no module boundary violations',
      'Vercel deployment checklist as reusable runbook',
    ],
    steps: [
      {
        id:          'env-var-audit',
        title:       'Audit environment variables before deploy',
        type:        'failure',
        href:        '/failures/environment-variable-missing-production',
        duration:    '15 min',
        description: 'The most common cause of silent production failures is an env var scoped to Development only. Read this failure report, then verify every required variable has Production checked in the Vercel dashboard.',
        evidenceRef: 'environment-variable-missing-production',
      },
      {
        id:          'edge-runtime-audit',
        title:       'Audit edge runtime declarations',
        type:        'failure',
        href:        '/failures/edge-runtime-deployment-failure',
        duration:    '20 min',
        description: 'Edge runtime restricts which Node.js APIs are available. Grep your codebase for `export const runtime = "edge"` and verify none of those routes use crypto, fs, or Node-only modules.',
        evidenceRef: 'edge-runtime-deployment-failure',
      },
      {
        id:          'module-boundary-check',
        title:       'Verify client bundle module boundaries',
        type:        'failure',
        href:        '/failures/server-module-client-bundle',
        duration:    '20 min',
        description: 'Node.js modules pulled into the client bundle cause build failures that are hard to trace. Run `next build` locally and inspect for "Module not found" or "fs" errors in the client bundle output.',
        evidenceRef: 'server-module-client-bundle',
      },
      {
        id:          'dependency-changelog',
        title:       'Read changelogs for recent dependency upgrades',
        type:        'failure',
        href:        '/failures/next-mdx-remote-v6-blockjs',
        duration:    '15 min',
        description: 'Silent behavioral changes in new dependency versions are a recurring failure pattern. For any major version upgrade in your last PR, read the changelog before deploying to production.',
        evidenceRef: 'next-mdx-remote-v6-blockjs',
      },
      {
        id:          'deployment-evolution-review',
        title:       'Study the Vercel deployment evolution case study',
        type:        'case-study',
        href:        '/case-studies/vercel-deployment-evolution',
        duration:    '25 min',
        description: 'Real trace of three deployment failures across one platform build. See how edge runtime, blockJS, and env var issues manifest in a real Vercel pipeline.',
        evidenceRef: 'vercel-deployment-evolution',
      },
      {
        id:          'deploy-and-verify',
        title:       'Deploy and verify production environment',
        type:        'action',
        duration:    '30 min',
        description: 'Run `next build` locally. Push to main. Monitor Vercel build logs. Verify all routes load. Check Vercel function logs for runtime errors. Test any API routes with real requests.',
      },
    ],
  },

  // ── 2. Debugging Mastery ───────────────────────────────────
  {
    id:            'debugging-mastery',
    title:         'Production Debugging Mastery',
    description:   'Build systematic debugging skills across the full failure archive — from first symptom to root cause to prevention.',
    targetOutcome: 'The ability to navigate any production failure from symptom to root cause using pattern recognition and structured debugging sequences.',
    estimatedTime: '3–4 h',
    difficulty:    'intermediate',
    category:      'debugging',
    prerequisites: ['Some production deployment experience'],
    caseStudyRef:  'ai-execution-lab-platform-launch',
    outcomes: [
      'Pattern recognition across failure types (runtime, config, auth, timing)',
      'Structured debugging sequence for each pattern',
      'Prevention checklist generation from failure analysis',
      'Confidence scoring awareness — know when you have the right fix',
    ],
    steps: [
      {
        id:          'pattern-library-orientation',
        title:       'Read the Failure Pattern Library',
        type:        'doc',
        href:        '/docs/failure-pattern-library',
        duration:    '30 min',
        description: 'Five named patterns cover most production failures. Read all five: Module Boundary Violations, Dependency Default Changes, Runtime Environment Scope Drift, Infrastructure Timing Dependencies, Authentication Encoding Pitfalls.',
      },
      {
        id:          'config-scope-failures',
        title:       'Study configuration scope failures',
        type:        'failure',
        href:        '/failures/environment-variable-missing-production',
        duration:    '20 min',
        description: 'The Runtime Environment Scope Drift pattern has two documented instances. Start with env vars in production — the most common and fastest to fix (confidence: 95).',
        evidenceRef: 'environment-variable-missing-production',
      },
      {
        id:          'auth-encoding-failures',
        title:       'Study authentication encoding failures',
        type:        'failure',
        href:        '/failures/wordpress-rest-api-auth-failure',
        duration:    '20 min',
        description: 'Authorization header encoding errors are subtle and easy to misdiagnose. This failure documents the exact Base64 encoding trap that breaks WordPress Application Password auth.',
        evidenceRef: 'wordpress-rest-api-auth-failure',
      },
      {
        id:          'infrastructure-timing-failures',
        title:       'Study infrastructure timing dependencies',
        type:        'failure',
        href:        '/failures/dns-subdomain-propagation-delay',
        duration:    '20 min',
        description: 'Timing failures look like deployment failures. DNS propagation + HTTPS cert provisioning creates a cascade where nothing appears to work for 24-48 hours. The fix is patience and monitoring, not code.',
        evidenceRef: 'dns-subdomain-propagation-delay',
      },
      {
        id:          'confidence-scoring',
        title:       'Study failure confidence scoring',
        type:        'doc',
        href:        '/docs/failure-memory-architecture',
        duration:    '25 min',
        description: 'Not all debugging paths are equally reliable. The confidence scoring system explains when a documented fix is battle-tested vs. a single-instance finding. Know how to weight evidence.',
      },
      {
        id:          'platform-launch-case-study',
        title:       'Trace three failures in the platform launch case study',
        type:        'case-study',
        href:        '/case-studies/ai-execution-lab-platform-launch',
        duration:    '30 min',
        description: 'Three failures hit in one platform build. Edge runtime (23 min), blockJS (41 min), fs module (18 min). See the full real-time debugging sequence from first error to confirmed fix.',
        evidenceRef: 'ai-execution-lab-platform-launch',
      },
      {
        id:          'debugging-sequence-practice',
        title:       'Apply pattern recognition to a real debugging session',
        type:        'action',
        duration:    '60 min',
        description: 'The next time you hit a production failure: identify the symptom, match it to a pattern family, find the highest-confidence debugging path in the archive, apply the fix, document the instance if it is new.',
      },
    ],
  },

  // ── 3. AI Business Launch ──────────────────────────────────
  {
    id:            'ai-business-launch',
    title:         'AI Business Launch',
    description:   'Go from zero to a live AI-powered product with real users — full stack, zero budget, real infrastructure.',
    targetOutcome: 'A live AI-powered application with real deployment infrastructure, analytics, and a documented operational architecture.',
    estimatedTime: '8–12 h',
    difficulty:    'advanced',
    category:      'ai-business',
    prerequisites: ['Basic React knowledge', 'GitHub account', 'Gemini API access'],
    caseStudyRef:  'scamcheck-architecture-build',
    outcomes: [
      'Live React application deployed to GitHub Pages',
      'AI feature powered by Gemini API with real usage',
      'GA4 analytics with cross-domain tracking configured',
      'SPA routing correctly handled (no 404 on refresh)',
      'All architecture decisions documented as operational memory',
    ],
    steps: [
      {
        id:          'architecture-study',
        title:       'Study the ScamCheck architecture case study',
        type:        'case-study',
        href:        '/case-studies/scamcheck-architecture-build',
        duration:    '30 min',
        description: 'React + Gemini + Firebase + GitHub Pages — a complete zero-budget AI app stack. Read the full architecture rationale before making your own stack decisions.',
        evidenceRef: 'scamcheck-architecture-build',
      },
      {
        id:          'trustseal-architecture',
        title:       'Study the TrustSeal architecture for payment integration',
        type:        'case-study',
        href:        '/case-studies/trustseal-architecture-build',
        duration:    '25 min',
        description: 'If your product requires payments, TrustSeal shows how Razorpay integrates with a React + Firebase stack on GitHub Pages. Architecture decisions, auth flow, and the subscription model.',
        isOptional:  true,
        evidenceRef: 'trustseal-architecture-build',
      },
      {
        id:          'spa-routing-prevention',
        title:       'Pre-empt the SPA routing 404',
        type:        'failure',
        href:        '/failures/vite-github-pages-spa-routing',
        duration:    '15 min',
        description: 'GitHub Pages does not support SPA routing by default. This failure hit both TrustSeal and ScamCheck. Read this before deploying — the 404.html redirect solution takes 5 minutes to implement.',
        evidenceRef: 'vite-github-pages-spa-routing',
      },
      {
        id:          'ga4-cross-domain',
        title:       'Configure GA4 cross-domain tracking correctly',
        type:        'failure',
        href:        '/failures/ga4-cross-domain-tracking-gap',
        duration:    '15 min',
        description: 'If your product lives on a subdomain of a parent domain, cookie_domain misconfiguration silently breaks cross-property attribution. Set this correctly before your first user.',
        evidenceRef: 'ga4-cross-domain-tracking-gap',
      },
      {
        id:          'build-and-deploy',
        title:       'Build and deploy to GitHub Pages',
        type:        'action',
        duration:    '60 min',
        description: 'Vite build, GitHub Actions workflow, gh-pages branch, 404.html redirect script, CNAME if custom domain. All of these are documented in the ScamCheck case study.',
      },
      {
        id:          'ai-publishing-system',
        title:       'Read the AI-assisted publishing system',
        type:        'case-study',
        href:        '/case-studies/ai-assisted-publishing-system',
        duration:    '20 min',
        description: 'Once your product is live, you need to document the build, create content around the architecture, and establish an operational memory. This case study shows the Claude Code–assisted publishing pipeline.',
        isOptional:  true,
      },
    ],
  },

  // ── 4. GEO Optimization ───────────────────────────────────
  {
    id:            'geo-optimization',
    title:         'GEO Authority Building',
    description:   'Build Generative Engine Optimization authority so AI search engines (ChatGPT, Perplexity, Claude) cite your platform as a reliable source.',
    targetOutcome: 'Content that scores above the answerability gate (7.0/10) and achieves measurable AI citation in target query categories.',
    estimatedTime: '4–6 h',
    difficulty:    'advanced',
    category:      'geo',
    prerequisites: ['Existing published content', 'Understanding of AI search mechanics'],
    outcomes: [
      'Entity density above threshold in all long-form content',
      'Answerability scores above 7.0 for target queries',
      'Citation potential above 7.0 for case studies and failure reports',
      'Query taxonomy mapped: owned, competitive, and gap queries identified',
    ],
    steps: [
      {
        id:          'geo-architecture',
        title:       'Understand the GEO Intelligence Architecture',
        type:        'doc',
        href:        '/docs/geo-intelligence-architecture',
        duration:    '30 min',
        description: 'Entity density, answerability scoring, citation potential, and query taxonomy — all four dimensions explained with implementation details and scoring thresholds.',
      },
      {
        id:          'entity-audit',
        title:       'Audit entity density across your key content',
        type:        'action',
        duration:    '45 min',
        description: 'Run `computeEntityDensity()` against your 10 most important content pieces. Threshold is 0.6 entities per 100 words (3 per 500 words). Flag all content below threshold for enrichment.',
      },
      {
        id:          'answerability-audit',
        title:       'Score answerability across key content',
        type:        'action',
        duration:    '45 min',
        description: 'The answerability gate is 7.0/10 across four dimensions: directAnswer, specificity, actionability, evidence. Content below gate needs enrichment — specific values, numbered steps, commit refs, timing data.',
      },
      {
        id:          'query-taxonomy-mapping',
        title:       'Map your query taxonomy',
        type:        'action',
        duration:    '60 min',
        description: 'Categorize your target queries as owned (you answer best), competitive (you compete), or gap (you should cover). Use `getQueryCoverage()` to measure current coverage percentage.',
      },
      {
        id:          'gap-query-content',
        title:       'Create content for highest-priority gap queries',
        type:        'action',
        duration:    '90 min',
        description: 'Gap queries are the highest-ROI GEO investment. For each gap query, create content that passes answerability gate with specific data, numbered steps, and real evidence references.',
      },
      {
        id:          'evidence-framework',
        title:       'Apply the Evidence Framework to all new content',
        type:        'doc',
        href:        '/docs/evidence-framework',
        duration:    '20 min',
        description: 'AI search engines cite content with verifiable evidence. The Evidence Framework defines quality standards for screenshots, terminal output, analytics data, and architecture diagrams.',
      },
    ],
  },

  // ── 5. Platform Ops Mastery ───────────────────────────────
  {
    id:            'platform-ops',
    title:         'Operational Platform Mastery',
    description:   'Build the full operational awareness layer — ecosystem observability, failure memory, evidence coverage, and operational debt management.',
    targetOutcome: 'A functioning operational intelligence layer: entity graph, failure confidence scoring, GEO coverage, and a live observability system.',
    estimatedTime: '5–8 h',
    difficulty:    'advanced',
    category:      'platform-ops',
    prerequisites: ['Existing Next.js platform', 'TypeScript', 'Published content'],
    caseStudyRef:  'ai-execution-lab-platform-launch',
    outcomes: [
      'Typed entity relationship graph with operational memory functions',
      'Failure memory with confidence scoring across all documented failures',
      'GEO intelligence library with entity density and answerability scoring',
      'Ops dashboard with ecosystem health, failure intelligence, and debt tracking',
      'Evidence framework applied to all new content',
    ],
    steps: [
      {
        id:          'platform-launch-study',
        title:       'Study the AI Execution Lab platform launch',
        type:        'case-study',
        href:        '/case-studies/ai-execution-lab-platform-launch',
        duration:    '35 min',
        description: 'The complete build log for this platform — tech stack decisions, MDX pipeline, failure archive, GEO system. The architecture documentation for everything described in the remaining steps.',
        evidenceRef: 'ai-execution-lab-platform-launch',
      },
      {
        id:          'operational-memory-study',
        title:       'Read the Operational Memory Architecture',
        type:        'doc',
        href:        '/docs/operational-memory-architecture',
        duration:    '30 min',
        description: 'Entity hierarchy, relationship types, knowledge inheritance patterns, and the query API. Understand the design before implementing your own graph.',
      },
      {
        id:          'failure-memory-study',
        title:       'Read the Failure Memory Architecture',
        type:        'doc',
        href:        '/docs/failure-memory-architecture',
        duration:    '25 min',
        description: 'Recurring failure memory, prevention inheritance, debugging lineage, and confidence scoring. The design rationale for lib/failure-memory.ts.',
      },
      {
        id:          'implement-entity-graph',
        title:       'Implement your entity relationship graph',
        type:        'action',
        duration:    '90 min',
        description: 'Create lib/operational-memory.ts following the entity ID convention [type]:[slug]. Register your failures, lessons, case studies, and docs as entities. Add typed relationships.',
      },
      {
        id:          'implement-failure-memory',
        title:       'Implement failure memory and confidence scoring',
        type:        'action',
        duration:    '60 min',
        description: 'Create lib/failure-memory.ts. Define RAW_FAILURES with instance counts, prevention step flags, and playbook flags. The confidence scoring rubric is defined in the failure-memory-architecture doc.',
      },
      {
        id:          'implement-geo-intelligence',
        title:       'Implement GEO intelligence scoring',
        type:        'action',
        duration:    '60 min',
        description: 'Create lib/geo-intelligence.ts with PLATFORM_ENTITIES and GEO_QUERY_TAXONOMY. Implement computeEntityDensity() and scoreAnswerability() following the scoring rubric in the geo-intelligence-architecture doc.',
      },
      {
        id:          'evidence-framework-study',
        title:       'Apply the Evidence Framework',
        type:        'doc',
        href:        '/docs/evidence-framework',
        duration:    '20 min',
        description: 'Evidence quality standards for the operational archive. Apply to all future failure reports and case studies.',
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Query API
// ─────────────────────────────────────────────────────────────

const pathwayById = new Map(EXECUTION_PATHWAYS.map(p => [p.id, p]))

/** Get a pathway by its ID */
export function getPathwayById(id: string): ExecutionPathway | null {
  return pathwayById.get(id) ?? null
}

/** Get all pathways in a category */
export function getPathwaysByCategory(category: PathwayCategory): ExecutionPathway[] {
  return EXECUTION_PATHWAYS.filter(p => p.category === category)
}

/** Get all pathways that reference a given content slug (in any step) */
export function getPathwaysForSlug(slug: string): ExecutionPathway[] {
  return EXECUTION_PATHWAYS.filter(p =>
    p.steps.some(s => s.evidenceRef === slug || s.href?.includes(slug)) ||
    p.caseStudyRef === slug
  )
}

/** Get a summary of all pathways (for listing pages) */
export function getPathwaySummaries(): Array<{
  id: string; title: string; description: string; difficulty: PathwayDifficulty
  category: PathwayCategory; estimatedTime: string; stepCount: number
  targetOutcome: string
}> {
  return EXECUTION_PATHWAYS.map(p => ({
    id:            p.id,
    title:         p.title,
    description:   p.description,
    difficulty:    p.difficulty,
    category:      p.category,
    estimatedTime: p.estimatedTime,
    stepCount:     p.steps.length,
    targetOutcome: p.targetOutcome,
  }))
}
