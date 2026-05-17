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
    estimatedHours: 35,
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
        description: 'Select and configure the right tools before spending anything.',
        lessons: [
          { id: 'choosing-your-product', title: 'Choosing Your First AI Product', type: 'lesson', duration: '20 min', description: 'How to evaluate product-market fit for AI tools without running ads.', status: 'available' },
          { id: 'free-tier-architecture', title: 'Free-Tier Infrastructure Architecture', type: 'lesson', duration: '25 min', description: 'Building your entire stack on free tiers until you hit real revenue.', status: 'coming-soon' },
          { id: 'llm-cost-control', title: 'LLM Cost Control from Day One', type: 'lesson', duration: '15 min', description: 'Prompt caching, input compression, and batching to keep API costs near zero.', status: 'coming-soon' },
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
  // 2. Claude Code Operator
  // ──────────────────────────────────────────────────────────
  {
    id:            'claude-code-operator',
    title:         'Claude Code Operator',
    tagline:       'Master Claude Code as a production development tool — not just a chat interface.',
    description:   'An advanced track for developers who want to operate Claude Code at the infrastructure level. Covers environment configuration, custom commands, hooks, MCP servers, multi-agent workflows, and production deployment patterns.',
    level:         'operator',
    estimatedHours: 40,
    accent:        'brand',
    status:        'available',
    outcomes: [
      'Configure Claude Code for maximum productivity in any codebase',
      'Build custom slash commands for your specific workflows',
      'Set up and use MCP servers for tool-augmented development',
      'Run multi-agent workflows for complex, parallel tasks',
      'Deploy production systems using Claude Code as the build system',
    ],
    prerequisites: [
      'Active Claude Pro or Team subscription',
      'Comfort with terminal and CLI tools',
      'Basic programming knowledge (any language)',
    ],
    tools: ['Claude Code', 'Node.js', 'Git', 'VS Code / Cursor'],
    modules: [
      {
        id: 'foundations',
        title: 'Environment & Configuration',
        description: 'Set up Claude Code correctly from the start.',
        lessons: [
          { id: 'dev-environment', title: 'Dev Environment Setup', type: 'lesson', duration: '20 min', description: 'Install, configure, and verify your Claude Code environment for production use.', status: 'available' },
          { id: 'claude-md-architecture', title: 'CLAUDE.md Architecture', type: 'lesson', duration: '25 min', description: 'Design a CLAUDE.md that makes every session context-aware and consistent.', status: 'coming-soon' },
          { id: 'project-settings', title: 'Project Settings & Permissions', type: 'lesson', duration: '15 min', description: 'Safe permission configuration for real codebases.', status: 'coming-soon' },
          { id: 'first-agentic-task', title: 'Your First Agentic Task', type: 'lesson', duration: '30 min', description: 'Run a real multi-step task and understand the tool-use loop.', status: 'coming-soon' },
        ],
      },
      {
        id: 'custom-commands',
        title: 'Slash Commands & Hooks',
        description: 'Extend Claude Code with your own vocabulary.',
        lessons: [
          { id: 'slash-command-anatomy', title: 'Anatomy of a Slash Command', type: 'lesson', duration: '20 min', description: 'How slash commands work, where they live, and how Claude resolves them.', status: 'coming-soon' },
          { id: 'build-your-commands', title: 'Build Your Command Library', type: 'playbook', duration: '45 min', description: 'Step-by-step: create 5 production-grade slash commands for common workflows.', status: 'coming-soon' },
          { id: 'hooks-system', title: 'Hooks: Pre and Post Actions', type: 'lesson', duration: '25 min', description: 'Automate actions before and after Claude Code runs tools.', status: 'coming-soon' },
        ],
      },
      {
        id: 'mcp-servers',
        title: 'MCP Servers',
        description: 'Connect Claude Code to external tools and data sources.',
        lessons: [
          { id: 'mcp-intro', title: 'What MCP Actually Does', type: 'lesson', duration: '20 min', description: 'The Model Context Protocol explained without the marketing hype.', status: 'coming-soon' },
          { id: 'useful-mcp-servers', title: 'Useful MCP Servers for Developers', type: 'lesson', duration: '30 min', description: 'Curated list of production-useful MCP servers and how to configure them.', status: 'coming-soon' },
          { id: 'build-mcp-server', title: 'Build a Custom MCP Server', type: 'lab', duration: '60 min', description: 'Build a minimal MCP server that connects Claude Code to your own API.', status: 'coming-soon' },
        ],
      },
      {
        id: 'multi-agent',
        title: 'Multi-Agent Workflows',
        description: 'Orchestrate parallel agents for complex tasks.',
        lessons: [
          { id: 'agent-orchestration', title: 'Agent Orchestration Patterns', type: 'lesson', duration: '25 min', description: 'When to use sub-agents, how to structure prompts for delegation.', status: 'coming-soon' },
          { id: 'parallel-execution', title: 'Parallel Execution Strategies', type: 'lesson', duration: '30 min', description: 'Run independent tasks in parallel without conflicts.', status: 'coming-soon' },
          { id: 'agent-debugging', title: 'Debugging Agent Failures', type: 'lab', duration: '40 min', description: 'Systematic approach to diagnosing when agents go off-track.', status: 'coming-soon' },
        ],
      },
      {
        id: 'production',
        title: 'Production Deployment Patterns',
        description: 'Use Claude Code as your production build system.',
        lessons: [
          { id: 'ci-integration', title: 'CI/CD Integration', type: 'lesson', duration: '30 min', description: 'Integrate Claude Code into GitHub Actions for automated code review.', status: 'coming-soon' },
          { id: 'operator-project', title: 'Final Project: Operator Certification', type: 'project', duration: '120 min', description: 'Build and ship a complete feature using only Claude Code — from spec to deployment.', status: 'coming-soon' },
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
          { id: 'rag-pipeline', title: 'Understanding RAG Pipelines', type: 'lesson', duration: '25 min', description: 'How retrieval-augmented generation decides what sources to use.', status: 'coming-soon' },
          { id: 'citation-signals', title: 'What Makes a Source Citable', type: 'lesson', duration: '20 min', description: 'The content and authority signals that determine AI citation probability.', status: 'coming-soon' },
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

  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
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

