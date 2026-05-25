/**
 * lib/entities.ts
 * Registry of core operational entities used across A Square Solutions.
 *
 * Entity slugs MUST match the tag string used in content frontmatter exactly.
 * Only define entities that have operational history documented in the Lab —
 * do not create entries for systems not yet referenced in failures, logs, or case studies.
 *
 * Entity pages are served at /tags/[slug] — when an entity entry exists here,
 * the tag page renders with rich operational context instead of a bare content list.
 */

export type EntityCategory =
  | 'platform'      // Vercel, GitHub Pages, Firebase
  | 'tool'          // Claude Code, VS Code, WPCode
  | 'technology'    // Next.js, MDX, React, Vite
  | 'service'       // Google Analytics 4, Google Search Console, Razorpay
  | 'concept'       // deployment, rate-limiting, authentication, caching
  | 'product'       // TrustSeal, ScamCheck, AI Execution Lab

export interface EntityMeta {
  /** Exact tag slug — must match frontmatter tag strings */
  slug: string
  /** Display name */
  name: string
  category: EntityCategory
  /**
   * 2–4 sentence operational description.
   * GEO-optimized: written to answer "what is X in the context of A Square Solutions operations?"
   * Avoid generic definitions — focus on how this entity is used operationally.
   */
  description: string
  /** When first operationally used in A Square Solutions infrastructure */
  since?: string
  /** Current operational status */
  status?: 'active' | 'deprecated' | 'evaluating'
  /** Which other entity slugs this system operationally depends on */
  depends_on?: string[]
  /** Which other entity slugs depend on this system */
  used_by?: string[]
  /** External documentation URL */
  docs_url?: string
}

// ─────────────────────────────────────────────────────────────
// Core entity registry
// Only systems with documented operational history in the Lab.
// ─────────────────────────────────────────────────────────────

export const CORE_ENTITIES: EntityMeta[] = [
  {
    slug:        'vercel',
    name:        'Vercel',
    category:    'platform',
    description: 'Primary deployment platform for AI Execution Lab (Next.js 15). All production builds, environment variable management, and static page generation run through Vercel. Has been the site of multiple documented failures: edge runtime restriction conflicts, missing production environment variable scopes, and build pipeline issues. Every Lab deployment since 2026-05-10 has shipped through Vercel.',
    since:       '2026-05',
    status:      'active',
    depends_on:  ['next.js', 'github-actions'],
    docs_url:    'https://vercel.com/docs',
  },
  {
    slug:        'next.js',
    name:        'Next.js',
    category:    'technology',
    description: 'Core framework for AI Execution Lab. Running Next.js 15 with the App Router, static site generation, and MDX content pipeline. The server/client module boundary and edge runtime behavior have produced documented failures. All content pages are statically generated at build time — no server-side rendering at runtime.',
    since:       '2026-05',
    status:      'active',
    depends_on:  ['vercel', 'next-mdx-remote'],
    docs_url:    'https://nextjs.org/docs',
  },
  {
    slug:        'firebase',
    name:        'Firebase',
    category:    'platform',
    description: 'Backend infrastructure for TrustSeal and ScamCheck: Firestore (rate limiting, user data, check history), Firebase Auth (user accounts and session management), and Firebase Functions v2 (serverless AI + payment endpoints). Both products share a Firebase project. Three documented failure patterns: default Node 18 runtime crashes on production invocation (fix: explicit nodejs22 in firebase.json), custom domain omission from Authorized Domains causes silent session loss on refresh, and Gemini API 429 rate limits require structured UX handling in the Cloud Function layer.',
    since:       '2026-01',
    status:      'active',
    depends_on:  ['firestore'],
    used_by:     ['trustseal', 'scamcheck'],
    docs_url:    'https://firebase.google.com/docs',
  },
  {
    slug:        'firestore',
    name:        'Firestore',
    category:    'technology',
    description: 'NoSQL document database used by TrustSeal and ScamCheck for rate limit tracking, user check history, and Razorpay webhook processing. Rate limit documents use expiresAt fields for TTL-based cleanup. Distributed rate limiting pattern: one Firestore document per IP+namespace per day, updated with atomic increments.',
    since:       '2026-01',
    status:      'active',
    depends_on:  ['firebase'],
    used_by:     ['trustseal', 'scamcheck'],
    docs_url:    'https://firebase.google.com/docs/firestore',
  },
  {
    slug:        'claude-code',
    name:        'Claude Code',
    category:    'tool',
    description: 'Primary AI-assisted engineering tool for the A Square Solutions operation. Used for all infrastructure building, content generation, MDX authoring, code refactoring, and operational planning across AI Execution Lab, TrustSeal, and ScamCheck. Context window exhaustion is a documented operational failure pattern — sessions over 3 hours require active checkpoint management.',
    since:       '2026-04',
    status:      'active',
    used_by:     ['ai-execution-lab'],
    docs_url:    'https://docs.anthropic.com/claude-code',
  },
  {
    slug:        'wordpress',
    name:        'WordPress',
    category:    'platform',
    description: 'CMS for the main A Square Solutions site (asquaresolution.com). Running Elementor + Header Footer & Blocks (HFE). Automated via the REST API using Claude Code scripts. Site of multiple documented failures: Application Password encoding issues, wpautop injection into HFE widgets, and LiteSpeed cache bypass behavior. WPCode used for PHP filter deployment without theme file edits.',
    since:       '2023',
    status:      'active',
    depends_on:  ['litespeed'],
    docs_url:    'https://developer.wordpress.org/rest-api/',
  },
  {
    slug:        'deployment',
    name:        'Deployment',
    category:    'concept',
    description: 'The operational act of pushing code or configuration changes to production. Across A Square Solutions, deployments run on three platforms: Vercel (AI Execution Lab / Next.js, auto-deploys on git push), GitHub Pages (TrustSeal + ScamCheck via Vite dist/.git worktree to gh-pages branch), and WordPress (asquaresolution.com via WP Admin or REST API). Each platform has distinct verification requirements — Vercel build success does not guarantee execution success, Firebase deploy success does not guarantee function invocation success, and LiteSpeed cache must be manually purged after every WordPress configuration change. GA4 analytics variables must be scoped to Production only in Vercel to prevent preview deployment traffic contaminating production metrics.',
    since:       '2026-01',
    status:      'active',
    depends_on:  ['vercel', 'github-pages'],
  },
  {
    slug:        'github-pages',
    name:        'GitHub Pages',
    category:    'platform',
    description: 'Static file hosting for TrustSeal and ScamCheck — served from custom subdomains (trustseal.asquaresolution.com, scamcheck.asquaresolution.com) via CNAME records. Key operational constraint: no URL rewrite capability. SPAs require the 404.html redirect trick for client-side routing to function on direct URL access or refresh. DNS propagation and HTTPS certificate provisioning are separate time-gated steps after DNS record creation.',
    since:       '2026-03',
    status:      'active',
    used_by:     ['trustseal', 'scamcheck'],
    docs_url:    'https://docs.github.com/en/pages',
  },
  {
    slug:        'vite',
    name:        'Vite',
    category:    'technology',
    description: 'Build tool for TrustSeal and ScamCheck (React/JSX). Outputs static bundles for GitHub Pages deployment. Key configuration: base: "/" for custom subdomain deployments. SPA routing requires the 404.html redirect trick to function on GitHub Pages — this is a documented operational failure when omitted from the initial deployment.',
    since:       '2026-01',
    status:      'active',
    depends_on:  ['github-pages'],
    used_by:     ['trustseal', 'scamcheck'],
    docs_url:    'https://vitejs.dev/guide/',
  },
  {
    slug:        'google-analytics-4',
    name:        'Google Analytics 4',
    category:    'service',
    description: 'Analytics platform shared across all A Square Solutions properties via a single GA4 property (G-MPQVF41ZYM). Cross-domain measurement is configured with cookie_domain: "asquaresolution.com" to maintain session continuity as users navigate between subdomains. Without this configuration, subdomain navigation appears as separate sessions attributed to direct traffic — a documented operational failure that produces inflated session counts.',
    since:       '2026-01',
    status:      'active',
    used_by:     ['ai-execution-lab', 'trustseal', 'scamcheck'],
    docs_url:    'https://developers.google.com/analytics/devguides/collection/ga4',
  },
  {
    slug:        'google-search-console',
    name:        'Google Search Console',
    category:    'service',
    description: 'SEO monitoring and indexing verification tool for AI Execution Lab (lab.asquaresolution.com). Used to monitor indexed page counts, Coverage reports, and crawl behavior after noindex deployments. A documented operational pattern: noindex rollouts cause GSC indexed page count drops 3–7 days after deployment — visually alarming without a pre-rollout baseline documented in the ops log.',
    since:       '2026-05',
    status:      'active',
    used_by:     ['ai-execution-lab'],
    docs_url:    'https://search.google.com/search-console/about',
  },
  {
    slug:        'razorpay',
    name:        'Razorpay',
    category:    'service',
    description: 'Payment processing platform for TrustSeal (India market). Handles subscription payments (₹149/month Basic, ₹299/month Pro) via Razorpay Checkout. Webhook processing is handled by Firebase Functions — webhook events update Firestore subscription records. Node 22 runtime migration was required for production stability.',
    since:       '2026-02',
    status:      'active',
    used_by:     ['trustseal'],
    depends_on:  ['firebase', 'firestore'],
    docs_url:    'https://razorpay.com/docs/',
  },
  {
    slug:        'litespeed',
    name:        'LiteSpeed Cache',
    category:    'platform',
    description: 'Server-side caching layer on asquaresolution.com (WordPress). LiteSpeed Cache operates at the server level and caches full HTML responses. Client-sent Cache-Control: no-cache headers are ignored for cache bypass decisions — they only control browser cache behavior. After any WordPress PHP filter or WPCode snippet deployment, LiteSpeed → Purge All must be run before verification. This behavior is a documented operational failure pattern.',
    since:       '2023',
    status:      'active',
    depends_on:  ['wordpress'],
    docs_url:    'https://docs.litespeedtech.com/lscache/',
  },
  {
    slug:        'authentication',
    name:        'Authentication',
    category:    'concept',
    description: 'Authentication patterns across A Square Solutions span three systems: WordPress Application Passwords (Base64-encoded Authorization headers for REST API access), Firebase Auth (email/password and Google OAuth for TrustSeal and ScamCheck), and Vercel environment variable scoping (API keys for Gemini and Razorpay). Three documented failure patterns: Application Password URL-encoding corrupts the credential hash; Firebase Auth session is lost on every page refresh when the custom production domain is absent from the Authorized Domains list; Razorpay test and live API keys must both be the same mode or payment flows fail silently.',
    status:      'active',
    depends_on:  ['wordpress', 'firebase', 'vercel'],
  },
  {
    slug:        'rate-limiting',
    name:        'Rate Limiting',
    category:    'concept',
    description: 'Distributed rate limiting for TrustSeal and ScamCheck — implemented via Firestore documents with TTL fields. Pattern: one document per IP+namespace per day, updated with atomic increments. expiresAt field enables Firestore TTL policy for automatic cleanup. Free tier: 3 checks per day per IP without authentication. Authenticated users get unlimited checks on paid plans (TrustSeal) or unlimited free checks (ScamCheck after sign-up).',
    status:      'active',
    depends_on:  ['firestore', 'firebase'],
    used_by:     ['trustseal', 'scamcheck'],
  },
  {
    slug:        'firebase-functions',
    name:        'Firebase Functions',
    category:    'platform',
    description: 'Firebase Cloud Functions v2 (Cloud Run-based) used as the serverless API layer for TrustSeal and ScamCheck. Handles Gemini AI analysis calls, Razorpay subscription creation and webhook processing, and quota enforcement — all operations that require server-side execution or secret API key access. Two critical deployment constraints: (1) default Node 18 runtime crashes on invocation — Node 22 must be explicitly declared in firebase.json; (2) when deploying Functions and Firestore rules in the same release, rules must deploy first — Functions-first ordering creates an auth context gap that produces 403 errors in production for the duration of the rules propagation window (documented production incident: 12 minutes, 14 failed requests on TrustSeal). Cold start latency on first invocation after idle is 2–4 seconds.',
    since:       '2026-02',
    status:      'active',
    depends_on:  ['firebase', 'firestore'],
    used_by:     ['trustseal', 'scamcheck'],
    docs_url:    'https://firebase.google.com/docs/functions',
  },
  {
    slug:        'gemini',
    name:        'Gemini AI',
    category:    'service',
    description: 'Google Gemini AI API (gemini-1.5-flash model) used as the AI analysis engine for ScamCheck (scam pattern detection) and TrustSeal (website trust verdict). All Gemini API calls run server-side inside Firebase Cloud Functions — the API key is never exposed to the client. Documented operational patterns: free tier enforces per-minute rate limits that produce 429 responses requiring structured UX handling; structured JSON output reliability depends on embedding the exact output schema in the prompt rather than relying on model defaults.',
    since:       '2026-01',
    status:      'active',
    depends_on:  ['firebase-functions'],
    used_by:     ['trustseal', 'scamcheck'],
    docs_url:    'https://ai.google.dev/gemini-api/docs',
  },
  {
    slug:        'react',
    name:        'React',
    category:    'technology',
    description: 'UI framework for TrustSeal and ScamCheck (React 18 SPA via Vite). Both products use React for the client application layer with Firebase Auth SDK for session management and Firestore real-time listeners (onSnapshot) for live data updates without page reloads. The SPA architecture requires the GitHub Pages 404.html redirect pattern for client-side routing to function on direct URL access.',
    since:       '2026-01',
    status:      'active',
    depends_on:  ['vite', 'firebase'],
    used_by:     ['trustseal', 'scamcheck'],
    docs_url:    'https://react.dev',
  },
  {
    slug:        'trustseal',
    name:        'TrustSeal',
    category:    'product',
    description: 'AI-powered website trust verifier at trustseal.asquaresolution.com. Users submit a URL and receive a structured trust verdict (score 0–100, label, detected signals, recommended action) generated by Gemini AI via a Firebase Cloud Function. Subscription-based monetization through Razorpay (INR payments). Stack: React 18 + Vite + Tailwind CSS + Firebase Auth + Firestore + Firebase Functions v2 (Node 22) + Gemini 1.5-flash + Razorpay + GitHub Pages. Three documented production failures resolved: Node 18 default runtime crashed all functions, custom domain omission from Firebase Authorized Domains caused silent session loss, and Razorpay test/live key mode mismatch silently failed all payments.',
    since:       '2026-01',
    status:      'active',
    depends_on:  ['firebase', 'firebase-functions', 'firestore', 'gemini', 'razorpay', 'github-pages', 'vite', 'react', 'authentication'],
    docs_url:    'https://trustseal.asquaresolution.com',
  },
  {
    slug:        'scamcheck',
    name:        'ScamCheck',
    category:    'product',
    description: 'AI-powered scam detection tool at scamcheck.asquaresolution.com. Users submit a message, URL, or interaction description and receive a structured verdict: scam probability (0–100%), verdict label, detected pattern categories, and a plain-language recommended action. Designed for non-technical users. Free tier — no payment layer. Stack: React 18 + Vite + Plain CSS + Firebase Auth + Firestore + Firebase Functions v2 (Node 22) + Gemini 1.5-flash + GitHub Pages. Key operational pattern: Gemini 429 rate limits on the free tier require structured UX handling — hanging spinners are a documented failure mode when 429 is treated as an unhandled exception.',
    since:       '2026-01',
    status:      'active',
    depends_on:  ['firebase', 'firebase-functions', 'firestore', 'gemini', 'github-pages', 'vite', 'react', 'authentication', 'rate-limiting'],
    docs_url:    'https://scamcheck.asquaresolution.com',
  },
  {
    slug:        'node',
    name:        'Node.js',
    category:    'technology',
    description: 'Server-side JavaScript runtime used for Firebase Cloud Functions in TrustSeal and ScamCheck. Critical operational constraint: Firebase Functions defaults to Node 18, which is incompatible with the npm packages used in these projects — all Cloud Function invocations fail at runtime without explicit Node 22 declaration in firebase.json. This is a documented production failure (firebase-functions-node-version-stability). The fix is to set `"runtime": "nodejs22"` in firebase.json before first deploy — discovered during TrustSeal build, proactively applied to ScamCheck before first deploy. ESM/CJS module format must also match the Node version and Firebase Functions runtime behavior.',
    since:       '2026-02',
    status:      'active',
    depends_on:  ['firebase-functions'],
    used_by:     ['trustseal', 'scamcheck'],
    docs_url:    'https://nodejs.org/en/docs',
  },
]

// ─────────────────────────────────────────────────────────────
// Lookup
// ─────────────────────────────────────────────────────────────

const _entityMap = new Map(CORE_ENTITIES.map(e => [e.slug, e]))

/** Get entity metadata for a tag slug. Returns null if not a registered entity. */
export function getEntityMeta(slug: string): EntityMeta | null {
  return _entityMap.get(slug) ?? null
}

/** All registered entity slugs — for identifying which tag pages should render as entity pages. */
export function getAllEntitySlugs(): string[] {
  return CORE_ENTITIES.map(e => e.slug)
}

/** Category label for display */
export function categoryLabel(cat: EntityCategory): string {
  const labels: Record<EntityCategory, string> = {
    platform:    'Platform',
    tool:        'Tool',
    technology:  'Technology',
    service:     'Service',
    concept:     'Concept',
    product:     'Product',
  }
  return labels[cat]
}
