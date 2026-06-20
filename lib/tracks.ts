// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type LessonType   = 'lesson' | 'playbook' | 'lab' | 'checkpoint' | 'project'
export type TrackLevel   = 'beginner' | 'intermediate' | 'advanced' | 'operator'
export type ContentStatus = 'available' | 'coming-soon'

export interface TrackAccent {
  text:    string
  bg:      string
  border:  string
  ring:    string
  glow:    string
}

export const TRACK_ACCENTS: Record<string, TrackAccent> = {
  amber:  { text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  ring: 'ring-amber-500/30',  glow: 'shadow-amber-500/10'  },
  brand:  { text: 'text-brand-400',  bg: 'bg-brand-500/10',  border: 'border-brand-500/25',  ring: 'ring-brand-500/30',  glow: 'shadow-brand-500/10'  },
  cyan:   { text: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/25',   ring: 'ring-cyan-500/30',   glow: 'shadow-cyan-500/10'   },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25', ring: 'ring-purple-500/30', glow: 'shadow-purple-500/10' },
  green:  { text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/25',  ring: 'ring-green-500/30',  glow: 'shadow-green-500/10'  },
} as const

export interface Lesson {
  id:          string
  title:       string
  type:        LessonType
  duration:    string
  description: string
  status:      ContentStatus
}

export interface Module {
  id:          string
  title:       string
  description: string
  lessons:     Lesson[]
}

export interface Track {
  id:            string
  title:         string
  tagline:       string
  description:   string
  level:         TrackLevel
  estimatedHours: number
  accent:        string          // key into TRACK_ACCENTS
  status:        ContentStatus
  modules:       Module[]
  outcomes:      string[]
  prerequisites: string[]
  tools:         string[]
}

// ─────────────────────────────────────────────────────────────
// Track registry — single source of truth
// ─────────────────────────────────────────────────────────────

export const TRACKS: Track[] = [
  // ──────────────────────────────────────────────────────────
  // 1. AI Business With Almost No Money
  // ──────────────────────────────────────────────────────────
  {
    id:            'ai-business-zero-budget',
    title:         'Build an AI Business With Almost No Money',
    tagline:       'From zero infrastructure to revenue — using AI as your unfair advantage.',
    description:   'A complete execution track for building a profitable AI-powered business without large upfront investment. Covers product selection, distribution, conversion, and systemization using modern AI tools.',
    level:         'beginner',
    estimatedHours: 45,
    accent:        'amber',
    status:        'available',
    outcomes: [
      'Select a viable AI-powered product for your market',
      'Launch a working product with minimal tooling cost',
      'Build distribution channels that don\'t require paid ads',
      'Convert organic traffic to recurring revenue',
      'Systemize operations so the business runs without you',
    ],
    prerequisites: [
      'Basic computer literacy',
      'Willingness to execute, not just learn',
    ],
    tools: ['Claude AI', 'Next.js', 'WordPress', 'ConvertKit', 'Stripe'],
    modules: [
      {
        id: 'zero-budget-stack',
        title: 'Zero-Budget AI Stack',
        description: 'Build a complete AI business infrastructure for under $40/month — tools, hosting, analytics, and your first organic traffic system.',
        lessons: [
          { id: 'choosing-your-product',          title: 'Choosing Your First AI Product',           type: 'lesson',  duration: '20 min', description: 'How to evaluate product-market fit for AI tools without running ads.',                               status: 'available' },
          { id: 'ai-tool-stack-budget',            title: 'AI Tool Stack Under $40/Month',            type: 'lesson',  duration: '25 min', description: 'The exact tools to pay for, what to use free, and the rule for when to add anything new.',          status: 'available' },
          { id: 'free-tier-architecture',          title: 'Free-Tier Infrastructure Architecture',    type: 'lesson',  duration: '25 min', description: 'Build a production-capable stack on GitHub, Vercel, and Cloudflare free tiers.',                    status: 'available' },
          { id: 'claude-wordpress-workflow',       title: 'Claude + WordPress Operational Workflow',  type: 'playbook', duration: '30 min', description: 'The exact research-to-publish workflow using Claude — without writing a word manually.',            status: 'available' },
          { id: 'github-for-non-developers',       title: 'GitHub for Non-Developers',                type: 'lesson',  duration: '20 min', description: 'Git and GitHub in plain terms — the five commands you need and nothing more.',                      status: 'available' },
          { id: 'vercel-for-beginners',            title: 'Vercel Deployment for Beginners',          type: 'lesson',  duration: '20 min', description: 'Deploy your first Next.js site, add a custom domain, and use preview deployments.',                 status: 'available' },
          { id: 'google-search-console-setup',     title: 'Google Search Console Setup',              type: 'playbook', duration: '20 min', description: 'Verify your site, submit your sitemap, and use Search Console as a content strategy tool.',        status: 'available' },
          { id: 'google-analytics-data-thinking',  title: 'Google Analytics + Data Thinking',         type: 'lesson',  duration: '25 min', description: 'Set up GA4, identify the 5 metrics that matter, and build a weekly data review habit.',            status: 'available' },
          { id: 'adsense-approval-reality',        title: 'AdSense Approval Reality',                 type: 'lesson',  duration: '20 min', description: 'What AdSense actually requires, why applications fail, and realistic RPM expectations.',            status: 'available' },
          { id: 'avoid-tool-subscription-traps',   title: 'How to Avoid Tool Subscription Traps',     type: 'lesson',  duration: '20 min', description: 'The psychology of subscription creep and a three-question framework for every new tool.',          status: 'available' },
          { id: 'first-organic-traffic-system',    title: 'Your First Organic Traffic System',        type: 'lesson',  duration: '30 min', description: 'The topic cluster model, content cadence, and realistic timeline from zero to first results.',     status: 'available' },
        ],
      },
      {
        id: 'first-product',
        title: 'Your First AI Product',
        description: 'Build and ship a real product in under two weeks.',
        lessons: [
          { id: 'mvp-with-claude', title: 'Building an MVP With Claude Code', type: 'lesson', duration: '40 min', description: 'End-to-end product build using Claude Code as your development partner.', status: 'coming-soon' },
          { id: 'landing-page-system', title: 'Landing Page That Converts', type: 'lesson', duration: '25 min', description: 'Page architecture and copy system optimized for AI-skeptic buyers.', status: 'coming-soon' },
          { id: 'launch-checklist', title: 'Pre-Launch Execution Checklist', type: 'checkpoint', duration: '30 min', description: 'Verification checklist before your first public launch.', status: 'coming-soon' },
        ],
      },
      {
        id: 'distribution',
        title: 'Distribution Without Paid Ads',
        description: 'Build channels that compound over time.',
        lessons: [
          { id: 'geo-for-startups', title: 'GEO for AI Products', type: 'lesson', duration: '30 min', description: 'Getting your product cited in AI search responses — the new SEO.', status: 'coming-soon' },
          { id: 'content-flywheel', title: 'The Content Flywheel System', type: 'lesson', duration: '25 min', description: 'Publishing system that generates leads while you sleep.', status: 'coming-soon' },
        ],
      },
      {
        id: 'revenue',
        title: 'Converting to Revenue',
        description: 'Turn traffic into paying customers systematically.',
        lessons: [
          { id: 'pricing-psychology', title: 'AI Product Pricing Psychology', type: 'lesson', duration: '20 min', description: 'Why most AI products undercharge and how to price for perceived value.', status: 'coming-soon' },
          { id: 'stripe-setup', title: 'Payment Infrastructure Setup', type: 'playbook', duration: '30 min', description: 'Stripe + webhook architecture for AI SaaS with no backend team.', status: 'coming-soon' },
        ],
      },
      {
        id: 'systemize',
        title: 'Systemizing for Scale',
        description: 'Remove yourself from operations without losing quality.',
        lessons: [
          { id: 'ai-ops-dashboard', title: 'AI Ops Dashboard', type: 'lab', duration: '35 min', description: 'Build an ops monitoring dashboard using Claude Code.', status: 'coming-soon' },
          { id: 'final-project', title: 'Final Project: Launch Your Business', type: 'project', duration: '120 min', description: 'End-to-end project: build, launch, and get your first 10 users.', status: 'coming-soon' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 2. Claude Code Operator (Flagship Track)
  // ──────────────────────────────────────────────────────────
  {
    id:             'claude-code-operator',
    title:          'Claude Code Operator',
    tagline:        'Production engineering with AI — environment to deployment, debugging to scale.',
    description:    'The complete operator track for AI-assisted software development. From workspace configuration and prompt engineering to GitHub workflows, Vercel deployment, WordPress automation, product development, debugging, and scaling multi-agent systems. Built on real production experience.',
    level:          'operator',
    estimatedHours: 60,
    accent:         'brand',
    status:         'available',
    outcomes: [
      'Configure a production Claude Code environment that briefs itself every session',
      'Write prompts that get consistent, correct output from complex codebases',
      'Operate a full GitHub workflow with Claude — branches, commits, and recovery',
      'Diagnose and fix Vercel build failures without iterating in production',
      'Build and run safe WordPress REST API automation pipelines',
      'Plan and ship AI-assisted features with production engineering discipline',
      'Debug systematically — reproduce, isolate, fix, verify',
      'Orchestrate multi-agent workflows for tasks that exceed a single context window',
    ],
    prerequisites: [
      'Active Claude Pro or Team subscription',
      'Comfort with terminal and CLI tools',
      'Basic programming knowledge (any language)',
      'A real project to work on — not a tutorial repo',
    ],
    tools: ['Claude Code', 'Node.js', 'Git', 'GitHub', 'Vercel', 'VS Code / Cursor'],
    modules: [
      // ── Module 1 ─────────────────────────────────────────
      {
        id: 'foundations',
        title: 'Environment + Workspace Setup',
        description: 'Configure Claude Code as a production tool — not just an installed binary.',
        lessons: [
          { id: 'choosing-your-ai-engineering-stack', title: 'Choosing Your AI Engineering Stack', type: 'lesson', duration: '35 min', description: 'Stack selection, architecture decisions, cost realities, and tradeoffs — before you configure anything.', status: 'available' },
          { id: 'dev-environment',       title: 'Dev Environment Setup',          type: 'lesson',  duration: '20 min', description: 'Install, configure, and verify your Claude Code environment for production use.',               status: 'available' },
          { id: 'claude-md-architecture',title: 'CLAUDE.md Architecture',          type: 'lesson',  duration: '25 min', description: 'Design a CLAUDE.md that fully briefs Claude at the start of every session.',                   status: 'available' },
          { id: 'project-settings',      title: 'Project Settings & Permissions',  type: 'lesson',  duration: '20 min', description: 'Safe, explicit permission configuration for real production codebases.',                       status: 'available' },
          { id: 'first-agentic-task',    title: 'Your First Agentic Task',         type: 'lesson',  duration: '30 min', description: 'Run a real multi-step task, read the tool-use loop, and catch problems early.',               status: 'available' },
          { id: 'ide-integration',       title: 'IDE Integration & Keybindings',   type: 'lesson',  duration: '15 min', description: 'Connect Claude Code to VS Code and Cursor for inline AI development.',                        status: 'coming-soon' },
        ],
      },
      // ── Module 2 ─────────────────────────────────────────
      {
        id: 'prompt-engineering',
        title: 'Production Prompt Engineering',
        description: 'Write prompts that get consistent, correct results from complex real-world codebases.',
        lessons: [
          { id: 'production-prompt-anatomy',    title: 'Anatomy of a Production Prompt',   type: 'lesson',   duration: '30 min', description: 'The 6-part framework for prompts that work reliably in production codebases.',              status: 'available' },
          { id: 'context-loading-strategies',   title: 'Context Loading Strategies',        type: 'lesson',   duration: '25 min', description: 'How to front-load the right context so Claude produces correct output from message one.', status: 'available' },
          { id: 'task-decomposition',           title: 'Task Decomposition for Agents',     type: 'lesson',   duration: '30 min', description: 'Break complex goals into atomic tasks Claude can execute without losing scope.',           status: 'available' },
          { id: 'prompt-failure-patterns',      title: 'Prompt Failure Patterns',           type: 'lesson',   duration: '20 min', description: 'The 8 most common prompt failures — and the exact fix for each.',                         status: 'available' },
        ],
      },
      // ── Module 3 ─────────────────────────────────────────
      {
        id: 'github-workflows',
        title: 'GitHub Workflow Systems',
        description: 'Integrate Claude Code into a real GitHub-based development workflow.',
        lessons: [
          { id: 'git-operations',    title: 'Git Operations with Claude Code',  type: 'lesson',   duration: '25 min', description: 'How Claude uses git, what it can see, and how to stage and commit safely.',                  status: 'available' },
          { id: 'branch-strategy',   title: 'Branch Strategy for AI Work',      type: 'lesson',   duration: '20 min', description: 'Feature branches, experiment branches, and the merge review discipline.',                    status: 'available' },
          { id: 'bad-commit-recovery', title: 'Bad Commit Recovery',            type: 'playbook', duration: '30 min', description: 'Recover from wrong files staged, broken code committed, and bad merge decisions.',           status: 'available' },
          { id: 'pr-review-workflow', title: 'PR Review Workflow',              type: 'lesson',   duration: '25 min', description: 'Use Claude to review diffs, catch regressions, and write meaningful PR descriptions.',       status: 'coming-soon' },
        ],
      },
      // ── Module 4 ─────────────────────────────────────────
      {
        id: 'vercel-deployment',
        title: 'Vercel Deployment + Recovery',
        description: 'Ship to production with confidence and recover from failures fast.',
        lessons: [
          { id: 'deployment-pipeline',      title: 'Deployment Pipeline Setup',        type: 'lesson',   duration: '25 min', description: 'Build the local→build→push→verify loop that catches failures before Vercel does.',      status: 'available' },
          { id: 'build-failure-diagnosis',  title: 'Build Failure Diagnosis',          type: 'playbook', duration: '35 min', description: 'Read Vercel logs systematically, categorize errors, and fix locally before re-pushing.', status: 'available' },
          { id: 'env-vars-secrets',         title: 'Environment Variables & Secrets',  type: 'lesson',   duration: '20 min', description: 'Manage .env files, Vercel environment variables, and secret rotation safely.',           status: 'available' },
          { id: 'rollback-strategies',      title: 'Rollback Strategies',              type: 'playbook', duration: '25 min', description: 'Instant rollback patterns when a deployment breaks production.',                         status: 'available' },
        ],
      },
      // ── Module 5 ─────────────────────────────────────────
      {
        id: 'wordpress-rest-api',
        title: 'WordPress + REST API Operations',
        description: 'Build safe, reliable automation pipelines for WordPress content operations.',
        lessons: [
          { id: 'wp-auth-patterns',         title: 'WP Authentication Patterns',        type: 'lesson',   duration: '20 min', description: 'Application Passwords, header format, auth testing, and common failure modes.',          status: 'available' },
          { id: 'content-patching-system',  title: 'Content Patching System',           type: 'playbook', duration: '45 min', description: 'The Read→Transform→Check→Apply→Verify pattern for safe content automation.',            status: 'available' },
          { id: 'bulk-operations',          title: 'Bulk Operations at Scale',          type: 'lab',      duration: '40 min', description: 'Process 500+ posts without timeouts, rate limits, or data corruption.',                  status: 'coming-soon' },
          { id: 'error-handling-rollback',  title: 'Error Handling & Rollback',         type: 'lesson',   duration: '25 min', description: 'Design automation that recovers gracefully from partial failures.',                      status: 'coming-soon' },
        ],
      },
      // ── Module 6 ─────────────────────────────────────────
      {
        id: 'product-development',
        title: 'AI-Assisted Product Development',
        description: 'Ship features faster without sacrificing production quality.',
        lessons: [
          { id: 'feature-planning-claude',  title: 'Feature Planning with Claude',        type: 'lesson',   duration: '30 min', description: 'Break product specs into executable tasks with defined ship criteria.',                  status: 'available' },
          { id: 'agentic-task-breakdown',   title: 'Agentic Task Architecture',           type: 'lesson',   duration: '30 min', description: 'Structure multi-file, multi-step tasks for reliable agentic execution.',                 status: 'coming-soon' },
          { id: 'testing-ai-code',          title: 'Testing AI-Generated Code',           type: 'lesson',   duration: '25 min', description: 'Validation patterns for code you didn\'t write but are responsible for.',               status: 'coming-soon' },
          { id: 'ship-velocity-quality',    title: 'Ship Velocity vs. Code Quality',      type: 'lesson',   duration: '20 min', description: 'Where to move fast and where to enforce standards in AI-assisted work.',                 status: 'coming-soon' },
        ],
      },
      // ── Module 7 ─────────────────────────────────────────
      {
        id: 'debugging-recovery',
        title: 'Debugging + Failure Recovery',
        description: 'Diagnose failures systematically — no guessing, no blind patching.',
        lessons: [
          { id: 'debugging-methodology',      title: 'Debugging Methodology',          type: 'lesson',   duration: '30 min', description: 'Reproduce → isolate → fix → verify. The discipline that separates operators from beginners.', status: 'available' },
          { id: 'reading-build-errors',       title: 'Reading Build Errors',           type: 'lesson',   duration: '25 min', description: 'TypeScript errors, module resolution, edge runtime failures — decoded.',                      status: 'available' },
          { id: 'runtime-failure-diagnosis',  title: 'Runtime Failure Diagnosis',      type: 'lab',      duration: '40 min', description: 'Diagnose failures that only appear in production, after deployment.',                         status: 'coming-soon' },
          { id: 'post-mortem-process',        title: 'Post-Mortem Process',            type: 'lesson',   duration: '20 min', description: 'Write post-mortems that prevent the same failure from recurring.',                           status: 'coming-soon' },
        ],
      },
      // ── Module 8 ─────────────────────────────────────────
      {
        id: 'scaling-systems',
        title: 'Scaling AI Execution Systems',
        description: 'Build AI workflows that scale beyond a single context window and single agent.',
        lessons: [
          { id: 'multi-agent-orchestration',  title: 'Multi-Agent Orchestration',         type: 'lesson',   duration: '35 min', description: 'Orchestrator + worker patterns for tasks that exceed a single context window.',            status: 'available' },
          { id: 'cicd-integration',           title: 'CI/CD Pipeline Integration',        type: 'lesson',   duration: '30 min', description: 'Integrate Claude Code into GitHub Actions for automated review and deployment.',           status: 'coming-soon' },
          { id: 'ai-ops-monitoring',          title: 'AI Ops Monitoring Dashboard',       type: 'lab',      duration: '50 min', description: 'Build a monitoring dashboard for long-running AI automation jobs.',                         status: 'coming-soon' },
          { id: 'personal-ops-playbook',      title: 'Your Personal Ops Playbook',        type: 'project',  duration: '90 min', description: 'Final project: build your personal AI ops playbook from this track\'s systems.',          status: 'coming-soon' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 3. GEO + AI Search Systems
  // ──────────────────────────────────────────────────────────
  {
    id:            'geo-ai-search',
    title:         'GEO + AI Search Systems',
    tagline:       'Engineer your content to appear in AI-generated answers — not just search results.',
    description:   'A systems-level track on Generative Engine Optimization. Covers how AI search engines select sources, content architecture for citation, authority signals, measurement frameworks, and scaling GEO operations.',
    level:         'intermediate',
    estimatedHours: 30,
    accent:        'cyan',
    status:        'available',
    outcomes: [
      'Understand how ChatGPT, Perplexity, and Gemini select sources to cite',
      'Design content architecture that maximizes AI citation probability',
      'Build measurable GEO testing frameworks',
      'Implement structured data and entity signals for AI visibility',
      'Scale content production that compounds GEO authority over time',
    ],
    prerequisites: [
      'Basic understanding of SEO concepts',
      'Access to a website you can modify',
    ],
    tools: ['Perplexity', 'ChatGPT', 'Semrush / Ahrefs', 'Google Search Console', 'WordPress'],
    modules: [
      {
        id: 'ai-search-mechanics',
        title: 'How AI Search Actually Works',
        description: 'Understand the systems before optimizing for them.',
        lessons: [
          { id: 'geo-vs-seo', title: 'GEO vs SEO: What Actually Changed', type: 'lesson', duration: '20 min', description: 'Why traditional SEO thinking fails in AI search and what replaces it.', status: 'available' },
          { id: 'rag-pipeline', title: 'Understanding RAG Pipelines', type: 'lesson', duration: '25 min', description: 'How retrieval-augmented generation decides what sources to use.', status: 'available' },
          { id: 'citation-signals', title: 'What Makes a Source Citable', type: 'lesson', duration: '20 min', description: 'The content and authority signals that determine AI citation probability.', status: 'available' },
        ],
      },
      {
        id: 'content-architecture',
        title: 'Content Architecture for GEO',
        description: 'Design content systems that AI engines trust and cite.',
        lessons: [
          { id: 'pillar-architecture', title: 'Pillar + Cluster Architecture', type: 'lesson', duration: '30 min', description: 'Build topical depth that establishes AI-recognized expertise.', status: 'coming-soon' },
          { id: 'entity-optimization', title: 'Entity and Schema Optimization', type: 'playbook', duration: '40 min', description: 'Structured data implementation that signals entities to AI models.', status: 'coming-soon' },
          { id: 'answer-engineering', title: 'Answer Engineering', type: 'lesson', duration: '25 min', description: 'Write content that directly answers the queries AI models receive.', status: 'coming-soon' },
        ],
      },
      {
        id: 'measurement',
        title: 'Measuring AI Visibility',
        description: 'Build a measurement system before optimizing.',
        lessons: [
          { id: 'geo-metrics', title: 'GEO Metrics That Matter', type: 'lesson', duration: '20 min', description: 'What to track, what to ignore, and how to set up a monitoring system.', status: 'coming-soon' },
          { id: 'testing-framework', title: 'GEO Testing Framework', type: 'lab', duration: '45 min', description: 'Build a systematic framework for testing and measuring GEO changes.', status: 'coming-soon' },
        ],
      },
      {
        id: 'scaling',
        title: 'Scaling GEO Operations',
        description: 'Build systems that compound authority over time.',
        lessons: [
          { id: 'content-operations', title: 'Content Operations at Scale', type: 'lesson', duration: '30 min', description: 'Production pipelines for consistent, authoritative content output.', status: 'coming-soon' },
          { id: 'geo-project', title: 'Final Project: GEO Audit & Strategy', type: 'project', duration: '90 min', description: 'Full GEO audit of a real site and 90-day execution strategy.', status: 'coming-soon' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 4. AI Automation Systems
  // ──────────────────────────────────────────────────────────
  {
    id:            'ai-automation-systems',
    title:         'AI Automation Systems',
    tagline:       'Build production automation pipelines that run reliably without human babysitting.',
    description:   'A practical engineering track on AI automation architecture. Covers API integration patterns, WordPress automation, quality gates, error handling, monitoring, and production-grade reliability.',
    level:         'advanced',
    estimatedHours: 45,
    accent:        'purple',
    status:        'available',
    outcomes: [
      'Design automation pipelines that handle errors gracefully',
      'Build WordPress + AI automation systems with dry-run gates',
      'Implement quality assertion frameworks before every write operation',
      'Set up monitoring for long-running automation jobs',
      'Create self-healing automation with fallback strategies',
    ],
    prerequisites: [
      'Python or JavaScript fundamentals',
      'Basic REST API knowledge',
      'A production environment to automate',
    ],
    tools: ['Python', 'Claude API', 'WordPress REST API', 'GitHub Actions', 'Vercel'],
    modules: [
      {
        id: 'automation-architecture',
        title: 'Automation Architecture',
        description: 'Design before you build — structure that survives production.',
        lessons: [
          { id: 'pipeline-design', title: 'Pipeline Design Principles', type: 'lesson', duration: '25 min', description: 'Read→Transform→Check→Apply→Verify: the pattern that prevents disasters.', status: 'available' },
          { id: 'dry-run-pattern', title: 'The Dry-Run Pattern', type: 'lesson', duration: '20 min', description: 'Why every automation script needs a dry-run mode and how to implement it.', status: 'coming-soon' },
          { id: 'error-taxonomy', title: 'Error Taxonomy for Automation', type: 'lesson', duration: '20 min', description: 'Classify errors before writing retry logic.', status: 'coming-soon' },
        ],
      },
      {
        id: 'api-patterns',
        title: 'API Integration Patterns',
        description: 'Connect systems reliably with minimal dependencies.',
        lessons: [
          { id: 'auth-patterns', title: 'Authentication Patterns', type: 'lesson', duration: '25 min', description: 'API key, OAuth, Application Password — choose the right pattern.', status: 'coming-soon' },
          { id: 'rate-limiting', title: 'Rate Limiting & Backoff', type: 'lesson', duration: '20 min', description: 'Exponential backoff and jitter for reliable API clients.', status: 'coming-soon' },
          { id: 'batch-operations', title: 'Batch Operations at Scale', type: 'playbook', duration: '40 min', description: 'Process 1000+ items without timeouts, rate limits, or memory issues.', status: 'coming-soon' },
        ],
      },
      {
        id: 'wordpress-automation',
        title: 'WordPress + AI Pipelines',
        description: 'The full stack for WordPress content automation.',
        lessons: [
          { id: 'rest-api-deep-dive', title: 'WordPress REST API Deep Dive', type: 'lesson', duration: '35 min', description: 'context=edit, application passwords, and the pitfalls that corrupt content.', status: 'coming-soon' },
          { id: 'content-patching', title: 'Safe Content Patching System', type: 'playbook', duration: '45 min', description: 'Build the full patch-verify-rollback system for content operations.', status: 'coming-soon' },
        ],
      },
      {
        id: 'quality-monitoring',
        title: 'Quality Gates & Monitoring',
        description: 'Production automation is only as good as its verification.',
        lessons: [
          { id: 'assertion-patterns', title: 'Assertion Pattern Library', type: 'lab', duration: '40 min', description: 'Build a reusable assertion library for content and API operations.', status: 'coming-soon' },
          { id: 'automation-project', title: 'Final Project: Full Automation Pipeline', type: 'project', duration: '120 min', description: 'Build and run a complete automation pipeline against a real environment.', status: 'coming-soon' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 5. AI Content + Distribution Systems
  // ──────────────────────────────────────────────────────────
  {
    id:            'ai-content-distribution',
    title:         'AI Content + Distribution Systems',
    tagline:       'Build content production pipelines that scale without a team.',
    description:   'A systems-level track on AI-augmented content operations. Covers content architecture, AI-assisted production workflows, multi-channel distribution, performance measurement, and running a content operation that compounds over time.',
    level:         'intermediate',
    estimatedHours: 30,
    accent:        'green',
    status:        'available',
    outcomes: [
      'Design a content architecture built for AI search and human audiences',
      'Build AI-assisted production workflows that 10x output quality',
      'Set up multi-channel distribution that runs systematically',
      'Measure content performance with metrics that connect to revenue',
      'Run a sustainable content operation without a full team',
    ],
    prerequisites: [
      'Basic content marketing understanding',
      'Access to Claude AI or similar',
    ],
    tools: ['Claude AI', 'WordPress', 'Ahrefs / Semrush', 'ConvertKit', 'Analytics'],
    modules: [
      {
        id: 'content-architecture',
        title: 'Content Architecture',
        description: 'Structure your content for maximum compounding value.',
        lessons: [
          { id: 'content-systems-thinking', title: 'Content Systems Thinking', type: 'lesson', duration: '20 min', description: 'Why standalone articles fail and how content systems compound.', status: 'available' },
          { id: 'topical-authority', title: 'Building Topical Authority', type: 'lesson', duration: '25 min', description: 'Cluster strategy for establishing expertise signals in AI and search.', status: 'coming-soon' },
          { id: 'content-types', title: 'Content Types for AI + Human Audiences', type: 'lesson', duration: '20 min', description: 'Match content format to query intent across both humans and AI models.', status: 'coming-soon' },
        ],
      },
      {
        id: 'ai-production',
        title: 'AI-Assisted Production',
        description: 'Build workflows that maintain quality at volume.',
        lessons: [
          { id: 'production-workflow', title: 'The AI Production Workflow', type: 'playbook', duration: '35 min', description: 'End-to-end: brief→draft→review→publish with AI at every stage.', status: 'coming-soon' },
          { id: 'quality-control', title: 'Quality Control Without Editors', type: 'lesson', duration: '25 min', description: 'Automated and semi-automated quality checks for AI-generated content.', status: 'coming-soon' },
        ],
      },
      {
        id: 'distribution',
        title: 'Multi-Channel Distribution',
        description: 'Systematize distribution so every piece reaches its full audience.',
        lessons: [
          { id: 'distribution-system', title: 'Building a Distribution System', type: 'lesson', duration: '25 min', description: 'Channel selection, scheduling, and repurposing frameworks.', status: 'coming-soon' },
          { id: 'email-automation', title: 'Email Automation for Content', type: 'playbook', duration: '30 min', description: 'Set up automated email sequences triggered by content performance.', status: 'coming-soon' },
        ],
      },
      {
        id: 'performance',
        title: 'Performance & Scale',
        description: 'Measure what matters and scale what works.',
        lessons: [
          { id: 'content-analytics', title: 'Content Analytics That Connect to Revenue', type: 'lesson', duration: '25 min', description: 'Build a simple analytics stack that shows content ROI.', status: 'coming-soon' },
          { id: 'content-project', title: 'Final Project: 30-Day Content Operation', type: 'project', duration: '90 min', description: 'Plan and launch a 30-day content operation using all systems from the track.', status: 'coming-soon' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 6. AI for Non-Developers
  // ──────────────────────────────────────────────────────────
  {
    id:            'ai-for-non-developers',
    title:         'AI for Non-Developers',
    tagline:       'Build real AI-powered workflows without writing code.',
    description:   'A complete execution track for people who want to build, run, and benefit from AI systems without programming skills. Covers no-code AI workflows, AI-assisted business operations, content production, and automation tools that substitute for technical capability.',
    level:         'beginner',
    estimatedHours: 35,
    accent:        'green',
    status:        'available',
    outcomes: [
      'Build a complete AI-powered workflow for your current work without coding',
      'Automate repetitive tasks using no-code tools and AI integrations',
      'Produce content at 5× your current speed with maintained quality',
      'Connect the tools you already use through AI-powered automation',
      'Set accurate expectations for what AI can and cannot do for non-technical users',
    ],
    prerequisites: [
      'Basic computer literacy — files, browser, email',
      'No coding knowledge required',
    ],
    tools: ['Claude AI (web)', 'Zapier', 'Make.com', 'Notion AI', 'Google Sheets'],
    modules: [
      {
        id: 'ai-tools-orientation',
        title: 'AI Tools Orientation',
        description: 'What AI tools can actually do — and what they can\'t. Start here.',
        lessons: [
          { id: 'ai-tools-reality-check',      title: 'What AI Does and Does Not Do',              type: 'lesson',     duration: '30 min', description: 'Accurate expectations before spending time or money on AI tools.',                   status: 'coming-soon' },
          { id: 'choosing-your-ai-tools',       title: 'Choosing Your AI Tools Without Overpaying', type: 'lesson',     duration: '25 min', description: 'The $0 stack that covers 90% of non-developer use cases.',                         status: 'coming-soon' },
          { id: 'prompting-without-coding',     title: 'Prompting for Non-Technical Users',         type: 'lesson',     duration: '25 min', description: 'How to communicate with AI clearly without any programming background.',            status: 'coming-soon' },
          { id: 'first-ai-workflow',            title: 'Your First Real AI Workflow',               type: 'playbook',   duration: '30 min', description: 'Build a complete AI-assisted workflow for a task you do every week.',              status: 'coming-soon' },
        ],
      },
      {
        id: 'no-code-automation',
        title: 'No-Code AI Automation',
        description: 'Connect tools and automate tasks without writing a line of code.',
        lessons: [
          { id: 'zapier-for-ai-workflows',      title: 'Zapier + AI Workflows',                    type: 'playbook',   duration: '35 min', description: 'Build Zapier automations that use Claude AI at each step.',                        status: 'coming-soon' },
          { id: 'make-automation-basics',       title: 'Make.com Automation Basics',               type: 'playbook',   duration: '30 min', description: 'Visual automation builder for connecting apps with AI processing.',                status: 'coming-soon' },
          { id: 'google-sheets-ai',             title: 'Google Sheets + AI Formulas',              type: 'lesson',     duration: '25 min', description: 'Use AI to write, clean, and analyze data in Google Sheets.',                       status: 'coming-soon' },
          { id: 'automation-checklist',         title: 'Your No-Code Automation Checklist',        type: 'checkpoint', duration: '20 min', description: 'Verify your automations work reliably before relying on them.',                    status: 'coming-soon' },
        ],
      },
      {
        id: 'business-operations',
        title: 'AI-Assisted Business Operations',
        description: 'Replace manual overhead with AI — customer communication, documents, meetings.',
        lessons: [
          { id: 'customer-communication-ai',   title: 'AI for Customer Communication',            type: 'lesson',     duration: '25 min', description: 'Handle first-response customer inquiries at scale using AI tools.',               status: 'coming-soon' },
          { id: 'document-workflow-ai',         title: 'Document and Report Automation',           type: 'playbook',   duration: '30 min', description: 'Automate document generation, formatting, and distribution.',                     status: 'coming-soon' },
          { id: 'ai-for-meetings',              title: 'Meeting Notes, Summaries, Action Items',   type: 'lesson',     duration: '20 min', description: 'AI tools that turn meetings into searchable, actionable records.',                 status: 'coming-soon' },
        ],
      },
      {
        id: 'content-without-code',
        title: 'Content Without Code',
        description: 'Produce quality content at scale without a team or technical skills.',
        lessons: [
          { id: 'ai-writing-workflow-beginner', title: 'AI-Assisted Writing Workflow',             type: 'playbook',   duration: '30 min', description: 'Research → outline → draft → edit → publish using AI at each stage.',             status: 'coming-soon' },
          { id: 'image-generation-workflow',    title: 'AI Image and Design Workflow',             type: 'playbook',   duration: '25 min', description: 'Generate and use AI images for content without design experience.',               status: 'coming-soon' },
          { id: 'non-dev-final-project',        title: 'Final Project: AI Workflow Audit',         type: 'project',    duration: '60 min', description: 'Audit your current work and implement AI workflows that save 5+ hours per week.', status: 'coming-soon' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 7. Solo AI Founder Systems
  // ──────────────────────────────────────────────────────────
  {
    id:            'solo-ai-founder',
    title:         'Solo AI Founder Systems',
    tagline:       'Build and run a real AI-powered business alone — systems that scale without hiring.',
    description:   'A systems-level track for solo founders building AI-powered businesses without teams. Covers the full operating stack: product development with AI tools, customer systems, financial infrastructure, content operations, and the patterns that allow one person to run what used to require five.',
    level:         'intermediate',
    estimatedHours: 50,
    accent:        'amber',
    status:        'available',
    outcomes: [
      'Build and maintain a production AI product without a development team',
      'Run customer-facing operations with AI handling first-response',
      'Maintain financial systems and metrics without hiring',
      'Produce and distribute content without a content team',
      'Know exactly when to build another system vs. when to hire',
    ],
    prerequisites: [
      'Basic familiarity with AI tools (Claude or equivalent)',
      'A specific project or business concept to work on',
      'Completed AI Business Zero Budget track or equivalent experience',
    ],
    tools: ['Claude Code', 'Stripe', 'ConvertKit', 'Vercel', 'WordPress', 'Zapier'],
    modules: [
      {
        id: 'solo-operations-architecture',
        title: 'Solo Operations Architecture',
        description: 'Design the operating system of a one-person AI business before building it.',
        lessons: [
          { id: 'solo-stack-design',            title: 'The Solo Founder Operating Stack',          type: 'lesson',     duration: '35 min', description: 'Which tools, systems, and patterns run a solo AI business efficiently.',            status: 'coming-soon' },
          { id: 'async-first-systems',          title: 'Async-First Systems Design',               type: 'lesson',     duration: '25 min', description: 'Build systems that don\'t require your constant presence to function.',            status: 'coming-soon' },
          { id: 'decision-making-solo',         title: 'Decision-Making Without a Team',           type: 'lesson',     duration: '20 min', description: 'Frameworks for making fast, documented decisions alone.',                         status: 'coming-soon' },
          { id: 'solo-ops-audit',               title: 'Ops Audit: What\'s Taking Your Time',      type: 'playbook',   duration: '30 min', description: 'Systematically identify where your time goes and which operations to automate.',  status: 'coming-soon' },
        ],
      },
      {
        id: 'solo-product-development',
        title: 'Product Development Alone',
        description: 'Ship and maintain a real product without a development team.',
        lessons: [
          { id: 'solo-dev-with-claude',         title: 'Solo Product Development with Claude Code', type: 'playbook',   duration: '40 min', description: 'End-to-end: feature planning, building, testing, and shipping alone with AI.',     status: 'coming-soon' },
          { id: 'feature-triage-solo',          title: 'Feature Triage for Solo Builders',         type: 'lesson',     duration: '25 min', description: 'How to decide what to build when you can only do one thing at a time.',           status: 'coming-soon' },
          { id: 'release-discipline-solo',      title: 'Release Discipline for Solo Products',     type: 'lesson',     duration: '20 min', description: 'Shipping cadence, version control, and rollback plans for one-person teams.',     status: 'coming-soon' },
        ],
      },
      {
        id: 'solo-customer-systems',
        title: 'Customer Systems',
        description: 'Handle customers at scale without a customer success team.',
        lessons: [
          { id: 'ai-customer-first-response',   title: 'AI-Handled First-Response System',         type: 'playbook',   duration: '35 min', description: 'Configure AI tools to handle common customer questions before you see them.',     status: 'coming-soon' },
          { id: 'feedback-loop-system',         title: 'Building a Feedback Loop Without Staff',   type: 'lesson',     duration: '25 min', description: 'Collect, synthesize, and act on customer feedback as a solo founder.',           status: 'coming-soon' },
          { id: 'churn-detection-solo',         title: 'Early Churn Detection',                    type: 'lesson',     duration: '20 min', description: 'Signals and systems that tell you when a customer is about to leave.',            status: 'coming-soon' },
        ],
      },
      {
        id: 'solo-financial-systems',
        title: 'Financial Systems',
        description: 'Run business finances without an accountant until you genuinely need one.',
        lessons: [
          { id: 'revenue-tracking-solo',        title: 'Revenue Tracking Without an Accountant',   type: 'playbook',   duration: '25 min', description: 'The minimal financial system that tells you what you need to know.',              status: 'coming-soon' },
          { id: 'pricing-iteration-system',     title: 'Pricing Iteration System',                 type: 'lesson',     duration: '20 min', description: 'How to test and adjust pricing without losing customers or leaving money behind.', status: 'coming-soon' },
        ],
      },
      {
        id: 'solo-scaling',
        title: 'Scaling Without Hiring',
        description: 'Grow revenue without proportional growth in team size.',
        lessons: [
          { id: 'when-to-hire-solo',            title: 'When to Hire vs. Build Another System',    type: 'lesson',     duration: '25 min', description: 'The specific signals that tell you hiring is the right move vs. more automation.',status: 'coming-soon' },
          { id: 'contractor-ai-hybrid',         title: 'Contractor + AI Hybrid Model',             type: 'lesson',     duration: '30 min', description: 'How to use part-time contractors efficiently when AI alone isn\'t enough.',      status: 'coming-soon' },
          { id: 'solo-founder-project',         title: 'Final Project: 90-Day Solo Operating Plan',type: 'project',    duration: '90 min', description: 'Build your complete operating plan: systems, tools, KPIs, and automation map.', status: 'coming-soon' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 8. AI-Assisted Freelancing
  // ──────────────────────────────────────────────────────────
  {
    id:            'ai-freelancing',
    title:         'AI-Assisted Freelancing',
    tagline:       'Deliver better work faster — and price it accordingly.',
    description:   'A practical track for freelancers in any field who want to use AI to deliver higher-quality work, win better clients, and build a sustainable practice. Covers AI integration into every phase of freelance work — proposals, delivery, communication, pricing, and positioning.',
    level:         'beginner',
    estimatedHours: 30,
    accent:        'cyan',
    status:        'available',
    outcomes: [
      'Cut delivery time by 40–60% using AI without reducing quality',
      'Write proposals that win at a higher rate with less effort',
      'Set prices that reflect AI-assisted output quality, not hours worked',
      'Build client systems that reduce administrative overhead',
      'Create a service offering that AI cannot easily commoditize',
    ],
    prerequisites: [
      'At least some freelance experience (or clear intent to start)',
      'Basic familiarity with one AI tool',
    ],
    tools: ['Claude AI', 'Notion', 'Calendly', 'Stripe', 'Google Docs', 'Canva AI'],
    modules: [
      {
        id: 'freelance-ai-stack',
        title: 'Freelance AI Stack',
        description: 'What AI changes for freelancers — and the tools that deliver that change.',
        lessons: [
          { id: 'freelance-ai-reality',         title: 'AI in Freelancing: What Changes and What Doesn\'t', type: 'lesson', duration: '25 min', description: 'Clear-eyed assessment of where AI helps freelancers and where it creates risk.',   status: 'coming-soon' },
          { id: 'freelance-ai-tools',           title: 'The Freelance AI Stack by Discipline',    type: 'lesson',   duration: '30 min', description: 'Tool recommendations for writing, design, development, research, and consulting.', status: 'coming-soon' },
          { id: 'ai-workflow-by-type',          title: 'AI Workflows for Your Type of Work',      type: 'playbook', duration: '35 min', description: 'Adapt the delivery acceleration workflow to your specific service type.',           status: 'coming-soon' },
          { id: 'quality-control-freelance',    title: 'Maintaining Quality When AI Drafts',      type: 'lesson',   duration: '20 min', description: 'The review and verification layer that keeps AI-assisted work at your standard.',  status: 'coming-soon' },
        ],
      },
      {
        id: 'proposal-client-systems',
        title: 'Proposal + Client Systems',
        description: 'Win better work and manage clients with less administrative overhead.',
        lessons: [
          { id: 'ai-proposal-system',           title: 'AI-Assisted Proposal System',             type: 'playbook', duration: '30 min', description: 'A repeatable proposal system that produces custom proposals in 30 minutes.',         status: 'coming-soon' },
          { id: 'client-qualification',         title: 'Client Qualification with AI Support',    type: 'lesson',   duration: '20 min', description: 'Identify high-value clients and pass on bad-fit engagements faster.',             status: 'coming-soon' },
          { id: 'client-communication-ai',      title: 'AI-Enhanced Client Communication',        type: 'lesson',   duration: '20 min', description: 'Communication templates and AI assistance for professional client interactions.',  status: 'coming-soon' },
        ],
      },
      {
        id: 'delivery-acceleration',
        title: 'Delivery Acceleration',
        description: 'Produce better work in less time — with AI at every stage.',
        lessons: [
          { id: 'research-acceleration-fl',     title: 'AI-Accelerated Research Workflow',        type: 'playbook', duration: '30 min', description: 'Cut research time by 60% without cutting depth using structured AI prompting.',     status: 'coming-soon' },
          { id: 'first-draft-system',           title: 'First Draft in 20% of the Time',          type: 'playbook', duration: '25 min', description: 'AI-assisted first draft workflow that produces something real, not just filler.',   status: 'coming-soon' },
          { id: 'revision-workflow-fl',         title: 'Revision Workflow with AI Feedback',      type: 'lesson',   duration: '20 min', description: 'Use AI as a critic to improve work before client review.',                        status: 'coming-soon' },
        ],
      },
      {
        id: 'pricing-positioning-fl',
        title: 'Pricing + Positioning',
        description: 'Capture the value of AI-accelerated output in your pricing.',
        lessons: [
          { id: 'pricing-for-ai-freelancers',   title: 'Pricing When AI Does the Heavy Lifting',  type: 'lesson',   duration: '25 min', description: 'Why hourly pricing breaks down with AI and what to charge instead.',               status: 'coming-soon' },
          { id: 'positioning-differentiation',  title: 'What AI Can\'t Replace About You',        type: 'lesson',   duration: '20 min', description: 'Identify and articulate the parts of your work that AI cannot commoditize.',       status: 'coming-soon' },
          { id: 'freelance-final-project',      title: 'Final Project: AI-Enhanced Service',      type: 'project',  duration: '60 min', description: 'Redesign your service offering to incorporate AI at every stage.',                status: 'coming-soon' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 9. AI for Students
  // ──────────────────────────────────────────────────────────
  {
    id:            'ai-for-students',
    title:         'AI for Students',
    tagline:       'Learn faster, research smarter, build a career — AI as a real tool, not a shortcut.',
    description:   'A practical track for students in any discipline who want to use AI to accelerate learning, improve research, produce better work, and build career capital. Focused on legitimate AI use — not shortcuts that produce shallow work, but systems that produce genuinely better results.',
    level:         'beginner',
    estimatedHours: 25,
    accent:        'purple',
    status:        'available',
    outcomes: [
      'Build a personal AI-assisted learning system for your discipline',
      'Conduct research faster and more thoroughly with AI tools',
      'Write and document better with AI as a thinking partner, not a ghostwriter',
      'Build a portfolio of real work demonstrating AI-native capability',
      'Develop career positioning that uses AI capability as a differentiator',
    ],
    prerequisites: [
      'Basic computer literacy',
      'Enrolled in study or actively learning a discipline',
    ],
    tools: ['Claude AI', 'Notion', 'Google Scholar', 'Zotero', 'VS Code (optional for technical tracks)'],
    modules: [
      {
        id: 'learning-acceleration',
        title: 'Learning Acceleration Systems',
        description: 'Use AI to genuinely understand material faster — not to skip the understanding.',
        lessons: [
          { id: 'ai-learning-reality',          title: 'AI for Learning: What It Accelerates and What It Harms', type: 'lesson', duration: '20 min', description: 'Honest assessment of where AI helps learning and where it produces fake understanding.', status: 'available' },
          { id: 'ai-prompting-fundamentals',    title: 'Prompting Fundamentals for Students', type: 'lesson',       duration: '25 min', description: 'Write clear, structured prompts that get useful, accurate answers — the skill that makes every other AI use better.', status: 'available' },
          { id: 'personal-learning-stack',      title: 'Building Your Personal AI Learning Stack', type: 'lesson',   duration: '25 min', description: 'The tools and workflows for AI-assisted learning in any discipline.',                status: 'coming-soon' },
          { id: 'concept-mastery-ai',           title: 'Using AI to Test Your Own Understanding', type: 'playbook', duration: '20 min', description: 'The Socratic AI method: use Claude to challenge your understanding of what you just learned.', status: 'coming-soon' },
          { id: 'note-taking-ai',               title: 'AI-Enhanced Note-Taking System',          type: 'playbook', duration: '20 min', description: 'Capture, organize, and synthesize learning with AI at each stage.',                  status: 'coming-soon' },
        ],
      },
      {
        id: 'research-writing',
        title: 'Research + Writing',
        description: 'Conduct better research and produce better academic work — with AI as a thinking tool.',
        lessons: [
          { id: 'verifying-ai-output',          title: 'Spotting Hallucinations & Verifying AI Output', type: 'lesson', duration: '20 min', description: 'Why AI states false things confidently — and a fast workflow to verify facts, quotes and citations before they reach your work.', status: 'available' },
          { id: 'research-workflow-student',    title: 'AI-Assisted Research Workflow for Students', type: 'playbook', duration: '30 min', description: 'Use Perplexity and Claude to accelerate literature discovery and synthesis.',       status: 'available' },
          { id: 'ai-writing-partner',           title: 'Writing with AI as a Partner (Not a Ghost)', type: 'lesson', duration: '25 min', description: 'How to use AI to improve your writing without undermining your authorship.',         status: 'available' },
          { id: 'citation-integrity',           title: 'Maintaining Citation Integrity with AI',   type: 'lesson',   duration: '20 min', description: 'Practical guidance on citing AI use, verifying AI-generated references, and academic honesty.', status: 'available' },
        ],
      },
      {
        id: 'career-building-student',
        title: 'Career Building',
        description: 'Use AI capability as career capital — not just a productivity hack.',
        lessons: [
          { id: 'career-positioning-ai',        title: 'Career Positioning in an AI World',       type: 'lesson',   duration: '25 min', description: 'Which careers benefit from AI skills and how to demonstrate those skills credibly.',  status: 'coming-soon' },
          { id: 'portfolio-with-ai',            title: 'Building a Portfolio That Shows AI Capability', type: 'playbook', duration: '30 min', description: 'What to build, document, and publish to demonstrate real AI-native skills.',   status: 'coming-soon' },
          { id: 'student-final-project',        title: 'Final Project: AI-Integrated Study System', type: 'project', duration: '90 min', description: 'Design and implement a complete AI learning and research workflow for your field.', status: 'coming-soon' },
        ],
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────

export function getTrack(id: string): Track | null {
  return TRACKS.find((t) => t.id === id) ?? null
}

export function getModule(trackId: string, moduleId: string): Module | null {
  const track = getTrack(trackId)
  return track?.modules.find((m) => m.id === moduleId) ?? null
}

export function getLesson(trackId: string, moduleId: string, lessonId: string): Lesson | null {
  const mod = getModule(trackId, moduleId)
  return mod?.lessons.find((l) => l.id === lessonId) ?? null
}

/** Flat list of all { trackId, moduleId, lessonId } — used for generateStaticParams */
export function getAllLessonPaths(): { track: string; module: string; lesson: string }[] {
  return TRACKS.flatMap((track) =>
    track.modules.flatMap((mod) =>
      mod.lessons.map((lesson) => ({
        track:  track.id,
        module: mod.id,
        lesson: lesson.id,
      }))
    )
  )
}

/** Adjacent lesson navigation within the same track */
export function getLessonNeighbors(
  trackId: string,
  moduleId: string,
  lessonId: string
): {
  prev: { module: Module; lesson: Lesson } | null
  next: { module: Module; lesson: Lesson } | null
} {
  const track = getTrack(trackId)
  if (!track) return { prev: null, next: null }

  // Flatten all lessons across modules in order
  const flat: { module: Module; lesson: Lesson }[] = track.modules.flatMap((mod) =>
    mod.lessons.map((lesson) => ({ module: mod, lesson }))
  )

  const idx = flat.findIndex(
    (x) => x.module.id === moduleId && x.lesson.id === lessonId
  )

  // Skip 'coming-soon' lessons so prev/next always land on a readable lesson
  // (avoids walking students into coming-soon dead-ends). If none remain in a
  // direction, return null.
  const isReadable = (x: { lesson: Lesson }) => x.lesson.status !== 'coming-soon'
  let prev: { module: Module; lesson: Lesson } | null = null
  for (let i = idx - 1; i >= 0; i--) { if (isReadable(flat[i])) { prev = flat[i]; break } }
  let next: { module: Module; lesson: Lesson } | null = null
  for (let i = idx + 1; i < flat.length; i++) { if (isReadable(flat[i])) { next = flat[i]; break } }

  return { prev, next }
}

/** Lesson position within its module — for "Lesson X of Y" display */
export function getLessonPosition(
  trackId: string,
  moduleId: string,
  lessonId: string
): { lessonNumber: number; totalLessons: number; moduleName: string } | null {
  const mod = getModule(trackId, moduleId)
  if (!mod) return null
  const idx = mod.lessons.findIndex((l) => l.id === lessonId)
  if (idx === -1) return null
  return {
    lessonNumber: idx + 1,
    totalLessons: mod.lessons.length,
    moduleName:   mod.title,
  }
}

/** Track-level stats */
export function getTrackStats(track: Track) {
  const totalLessons     = track.modules.reduce((n, m) => n + m.lessons.length, 0)
  const availableLessons = track.modules.reduce(
    (n, m) => n + m.lessons.filter((l) => l.status === 'available').length, 0
  )
  return { totalLessons, availableLessons, moduleCount: track.modules.length }
}

