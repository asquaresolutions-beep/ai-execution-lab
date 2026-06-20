// ─────────────────────────────────────────────────────────────
// Related content map
// Maps lessonId → array of related content items
// Covers cross-track connections, failure ↔ lesson bridges,
// playbook ↔ lesson connections, and cross-section references.
// ─────────────────────────────────────────────────────────────

export interface RelatedItem {
  label: string
  href:  string
  type:  'lesson' | 'playbook' | 'failure' | 'log' | 'case-study' | 'doc' | 'track' | 'lab'
  note?: string
}

// Cross-track and cross-section relationships
export const RELATED_CONTENT: Record<string, RelatedItem[]> = {

  // ── Claude Code Operator / Foundations ──────────────────────

  'choosing-your-ai-engineering-stack': [
    { label: 'Dev Environment Setup',          href: '/tracks/claude-code-operator/foundations/dev-environment',       type: 'lesson',  note: 'Next: configure the stack you chose' },
    { label: 'Free-Tier Infrastructure Architecture', href: '/tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture', type: 'lesson', note: 'If building a zero-budget operation' },
    { label: 'AI Tool Stack Under $40/Month',  href: '/tracks/ai-business-zero-budget/zero-budget-stack/ai-tool-stack-budget', type: 'lesson', note: 'Cost model companion' },
  ],

  'dev-environment': [
    { label: 'CLAUDE.md Architecture',         href: '/tracks/claude-code-operator/foundations/claude-md-architecture', type: 'lesson',  note: 'Configure the environment after setup' },
    { label: 'Project Settings & Permissions', href: '/tracks/claude-code-operator/foundations/project-settings',       type: 'lesson' },
    { label: 'edge-runtime-deployment-failure', href: '/failures/edge-runtime-deployment-failure', type: 'failure', note: 'Common early failure after environment setup' },
  ],

  'claude-md-architecture': [
    { label: 'Production Prompt Anatomy',      href: '/tracks/claude-code-operator/prompt-engineering/production-prompt-anatomy', type: 'lesson', note: 'CLAUDE.md shapes your prompts' },
    { label: 'Context Loading Strategies',     href: '/tracks/claude-code-operator/prompt-engineering/context-loading-strategies', type: 'lesson' },
    { label: 'Project Settings & Permissions', href: '/tracks/claude-code-operator/foundations/project-settings', type: 'lesson' },
  ],

  'project-settings': [
    { label: 'CLAUDE.md Architecture',         href: '/tracks/claude-code-operator/foundations/claude-md-architecture', type: 'lesson' },
    { label: 'Your First Agentic Task',        href: '/tracks/claude-code-operator/foundations/first-agentic-task', type: 'lesson', note: 'Ready to run after permissions are set' },
  ],

  'first-agentic-task': [
    { label: 'Debugging Methodology',          href: '/tracks/claude-code-operator/debugging-recovery/debugging-methodology', type: 'lesson', note: 'When agentic tasks go wrong' },
    { label: 'Production Prompt Anatomy',      href: '/tracks/claude-code-operator/prompt-engineering/production-prompt-anatomy', type: 'lesson' },
    { label: 'Task Decomposition for Agents',  href: '/tracks/claude-code-operator/prompt-engineering/task-decomposition', type: 'lesson' },
  ],

  // ── Claude Code Operator / Prompt Engineering ────────────────

  'production-prompt-anatomy': [
    { label: 'Context Loading Strategies',     href: '/tracks/claude-code-operator/prompt-engineering/context-loading-strategies', type: 'lesson', note: 'Load the right context for each prompt' },
    { label: 'Task Decomposition for Agents',  href: '/tracks/claude-code-operator/prompt-engineering/task-decomposition', type: 'lesson' },
    { label: 'CLAUDE.md Architecture',         href: '/tracks/claude-code-operator/foundations/claude-md-architecture', type: 'lesson', note: 'CLAUDE.md is the context layer for all prompts' },
  ],

  'context-loading-strategies': [
    { label: 'Production Prompt Anatomy',      href: '/tracks/claude-code-operator/prompt-engineering/production-prompt-anatomy', type: 'lesson' },
    { label: 'Task Decomposition for Agents',  href: '/tracks/claude-code-operator/prompt-engineering/task-decomposition', type: 'lesson' },
    { label: 'Multi-Agent Orchestration',      href: '/tracks/claude-code-operator/scaling-systems/multi-agent-orchestration', type: 'lesson', note: 'Context loading becomes critical at scale' },
  ],

  'task-decomposition': [
    { label: 'Your First Agentic Task',        href: '/tracks/claude-code-operator/foundations/first-agentic-task', type: 'lesson' },
    { label: 'Multi-Agent Orchestration',      href: '/tracks/claude-code-operator/scaling-systems/multi-agent-orchestration', type: 'lesson', note: 'Task decomposition at the orchestration level' },
    { label: 'Feature Planning with Claude',   href: '/tracks/claude-code-operator/product-development/feature-planning-claude', type: 'lesson' },
  ],

  // ── Claude Code Operator / GitHub Workflows ─────────────────

  'git-operations': [
    { label: 'Branch Strategy for AI Work',    href: '/tracks/claude-code-operator/github-workflows/branch-strategy', type: 'lesson', note: 'After understanding git ops, set your branch strategy' },
    { label: 'Bad Commit Recovery',            href: '/tracks/claude-code-operator/github-workflows/bad-commit-recovery', type: 'playbook' },
    { label: 'Deployment Pipeline Setup',      href: '/tracks/claude-code-operator/vercel-deployment/deployment-pipeline', type: 'lesson', note: 'Git pushes trigger Vercel deploys' },
  ],

  'branch-strategy': [
    { label: 'Git Operations with Claude Code', href: '/tracks/claude-code-operator/github-workflows/git-operations', type: 'lesson' },
    { label: 'Bad Commit Recovery',             href: '/tracks/claude-code-operator/github-workflows/bad-commit-recovery', type: 'playbook', note: 'When branch strategy breaks down' },
    { label: 'Build Failure Diagnosis',         href: '/tracks/claude-code-operator/vercel-deployment/build-failure-diagnosis', type: 'playbook' },
  ],

  'bad-commit-recovery': [
    { label: 'Git Operations with Claude Code', href: '/tracks/claude-code-operator/github-workflows/git-operations', type: 'lesson' },
    { label: 'Debugging Methodology',           href: '/tracks/claude-code-operator/debugging-recovery/debugging-methodology', type: 'lesson' },
    { label: 'Build Failure Diagnosis',         href: '/tracks/claude-code-operator/vercel-deployment/build-failure-diagnosis', type: 'playbook', note: 'If the bad commit broke the build' },
  ],

  // ── Claude Code Operator / Vercel Deployment ────────────────

  'deployment-pipeline': [
    { label: 'Build Failure Diagnosis',         href: '/tracks/claude-code-operator/vercel-deployment/build-failure-diagnosis', type: 'playbook', note: 'What to do when the pipeline fails' },
    { label: 'edge-runtime-deployment-failure', href: '/failures/edge-runtime-deployment-failure', type: 'failure', note: 'Real failure from this pipeline' },
    { label: 'next-mdx-remote-v6-blockjs',      href: '/failures/next-mdx-remote-v6-blockjs', type: 'failure', note: 'Build-breaking MDX failure' },
  ],

  'build-failure-diagnosis': [
    { label: 'Deployment Pipeline Setup',       href: '/tracks/claude-code-operator/vercel-deployment/deployment-pipeline', type: 'lesson' },
    { label: 'Reading Build Errors',            href: '/tracks/claude-code-operator/debugging-recovery/reading-build-errors', type: 'lesson', note: 'Deeper dive on error patterns' },
    { label: 'edge-runtime-deployment-failure', href: '/failures/edge-runtime-deployment-failure', type: 'failure', note: 'Documented production failure — edge runtime' },
    { label: 'next-mdx-remote-v6-blockjs',      href: '/failures/next-mdx-remote-v6-blockjs', type: 'failure', note: 'Documented production failure — MDX blockJS' },
  ],

  // ── Claude Code Operator / WordPress REST API ────────────────

  'wp-auth-patterns': [
    { label: 'Content Patching System',         href: '/tracks/claude-code-operator/wordpress-rest-api/content-patching-system', type: 'playbook', note: 'Authentication is step one of patching' },
    { label: 'WordPress REST API Automation',   href: '/playbooks/wp-rest-api-automation-playbook', type: 'playbook', note: 'Full automation playbook' },
    { label: 'Claude + WordPress Operational Workflow', href: '/tracks/ai-business-zero-budget/zero-budget-stack/claude-wordpress-workflow', type: 'playbook', note: 'Simpler WP workflow for non-engineers' },
  ],

  'content-patching-system': [
    { label: 'WP Authentication Patterns',      href: '/tracks/claude-code-operator/wordpress-rest-api/wp-auth-patterns', type: 'lesson' },
    { label: 'WordPress REST API Automation',   href: '/playbooks/wp-rest-api-automation-playbook', type: 'playbook', note: 'Extended operational reference' },
    { label: 'Pipeline Design Principles',      href: '/tracks/ai-automation-systems/automation-architecture/pipeline-design', type: 'lesson', note: 'Same pattern in broader context' },
  ],

  // ── Claude Code Operator / Product Development ───────────────

  'feature-planning-claude': [
    { label: 'Task Decomposition for Agents',   href: '/tracks/claude-code-operator/prompt-engineering/task-decomposition', type: 'lesson' },
    { label: 'Debugging Methodology',           href: '/tracks/claude-code-operator/debugging-recovery/debugging-methodology', type: 'lesson', note: 'After shipping: how to handle failures' },
    { label: 'Choosing Your First AI Product',  href: '/tracks/ai-business-zero-budget/zero-budget-stack/choosing-your-product', type: 'lesson', note: 'If still in product-selection phase' },
  ],

  // ── Claude Code Operator / Debugging + Recovery ──────────────

  'debugging-methodology': [
    { label: 'Reading Build Errors',            href: '/tracks/claude-code-operator/debugging-recovery/reading-build-errors', type: 'lesson', note: 'Companion: TypeScript + module errors' },
    { label: 'Build Failure Diagnosis',         href: '/tracks/claude-code-operator/vercel-deployment/build-failure-diagnosis', type: 'playbook' },
    { label: 'Failure Archive',                 href: '/failures', type: 'failure', note: 'Real-world examples of production failures' },
    { label: 'edge-runtime-deployment-failure', href: '/failures/edge-runtime-deployment-failure', type: 'failure' },
  ],

  'reading-build-errors': [
    { label: 'Debugging Methodology',           href: '/tracks/claude-code-operator/debugging-recovery/debugging-methodology', type: 'lesson' },
    { label: 'Build Failure Diagnosis',         href: '/tracks/claude-code-operator/vercel-deployment/build-failure-diagnosis', type: 'playbook', note: 'Apply these patterns to Vercel logs' },
    { label: 'next-mdx-remote-v6-blockjs',      href: '/failures/next-mdx-remote-v6-blockjs', type: 'failure', note: 'Exact TypeScript/module error from production' },
    { label: 'server-module-client-bundle',     href: '/failures/server-module-client-bundle', type: 'failure' },
  ],

  // ── Claude Code Operator / Scaling Systems ───────────────────

  'multi-agent-orchestration': [
    { label: 'Task Decomposition for Agents',   href: '/tracks/claude-code-operator/prompt-engineering/task-decomposition', type: 'lesson', note: 'Prerequisite: decompose before orchestrating' },
    { label: 'Context Loading Strategies',      href: '/tracks/claude-code-operator/prompt-engineering/context-loading-strategies', type: 'lesson' },
    { label: 'Feature Planning with Claude',    href: '/tracks/claude-code-operator/product-development/feature-planning-claude', type: 'lesson' },
  ],

  // ── AI Business / Zero Budget Stack ─────────────────────────

  'choosing-your-product': [
    { label: 'AI Tool Stack Under $40/Month',   href: '/tracks/ai-business-zero-budget/zero-budget-stack/ai-tool-stack-budget', type: 'lesson', note: 'Cost infrastructure for the product you chose' },
    { label: 'Free-Tier Infrastructure Architecture', href: '/tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture', type: 'lesson' },
    { label: 'GEO vs SEO: What Actually Changed', href: '/tracks/geo-ai-search/ai-search-mechanics/geo-vs-seo', type: 'lesson', note: 'How AI search finds products like yours' },
  ],

  'ai-tool-stack-budget': [
    { label: 'How to Avoid Tool Subscription Traps', href: '/tracks/ai-business-zero-budget/zero-budget-stack/avoid-tool-subscription-traps', type: 'lesson', note: 'Read together — one defines the stack, one defends it' },
    { label: 'Free-Tier Infrastructure Architecture', href: '/tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture', type: 'lesson' },
    { label: 'Choosing Your AI Engineering Stack', href: '/tracks/claude-code-operator/foundations/choosing-your-ai-engineering-stack', type: 'lesson', note: 'Engineering-level companion for technical users' },
  ],

  'free-tier-architecture': [
    { label: 'Vercel Deployment for Beginners', href: '/tracks/ai-business-zero-budget/zero-budget-stack/vercel-for-beginners', type: 'lesson', note: 'Implement the architecture you designed' },
    { label: 'GitHub for Non-Developers',       href: '/tracks/ai-business-zero-budget/zero-budget-stack/github-for-non-developers', type: 'lesson' },
    { label: 'Deployment Pipeline Setup',       href: '/tracks/claude-code-operator/vercel-deployment/deployment-pipeline', type: 'lesson', note: 'Advanced: production deployment pipeline' },
  ],

  'claude-wordpress-workflow': [
    { label: 'WP Authentication Patterns',      href: '/tracks/claude-code-operator/wordpress-rest-api/wp-auth-patterns', type: 'lesson', note: 'Technical depth for the auth step' },
    { label: 'Content Patching System',         href: '/tracks/claude-code-operator/wordpress-rest-api/content-patching-system', type: 'playbook', note: 'Full automation playbook' },
    { label: 'WordPress REST API Automation',   href: '/playbooks/wp-rest-api-automation-playbook', type: 'playbook' },
  ],

  'github-for-non-developers': [
    { label: 'Free-Tier Infrastructure Architecture', href: '/tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture', type: 'lesson' },
    { label: 'Vercel Deployment for Beginners', href: '/tracks/ai-business-zero-budget/zero-budget-stack/vercel-for-beginners', type: 'lesson', note: 'GitHub connects directly to Vercel' },
    { label: 'Git Operations with Claude Code', href: '/tracks/claude-code-operator/github-workflows/git-operations', type: 'lesson', note: 'Advanced: git for technical users' },
  ],

  'vercel-for-beginners': [
    { label: 'Free-Tier Infrastructure Architecture', href: '/tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture', type: 'lesson' },
    { label: 'GitHub for Non-Developers',       href: '/tracks/ai-business-zero-budget/zero-budget-stack/github-for-non-developers', type: 'lesson' },
    { label: 'edge-runtime-deployment-failure', href: '/failures/edge-runtime-deployment-failure', type: 'failure', note: 'Common Vercel failure to know about' },
  ],

  'google-search-console-setup': [
    { label: 'Google Analytics + Data Thinking', href: '/tracks/ai-business-zero-budget/zero-budget-stack/google-analytics-data-thinking', type: 'lesson', note: 'Set up alongside GSC' },
    { label: 'Your First Organic Traffic System', href: '/tracks/ai-business-zero-budget/zero-budget-stack/first-organic-traffic-system', type: 'lesson', note: 'GSC feeds your traffic strategy' },
    { label: 'GEO vs SEO: What Actually Changed', href: '/tracks/geo-ai-search/ai-search-mechanics/geo-vs-seo', type: 'lesson', note: 'Beyond Google — AI search visibility' },
  ],

  'google-analytics-data-thinking': [
    { label: 'Google Search Console Setup',     href: '/tracks/ai-business-zero-budget/zero-budget-stack/google-search-console-setup', type: 'playbook', note: 'GA4 + GSC are always used together' },
    { label: 'AdSense Approval Reality',        href: '/tracks/ai-business-zero-budget/zero-budget-stack/adsense-approval-reality', type: 'lesson', note: 'Analytics informs monetization decisions' },
  ],

  'adsense-approval-reality': [
    { label: 'Google Analytics + Data Thinking', href: '/tracks/ai-business-zero-budget/zero-budget-stack/google-analytics-data-thinking', type: 'lesson' },
    { label: 'Your First Organic Traffic System', href: '/tracks/ai-business-zero-budget/zero-budget-stack/first-organic-traffic-system', type: 'lesson', note: 'Traffic is the prerequisite for AdSense' },
  ],

  'avoid-tool-subscription-traps': [
    { label: 'AI Tool Stack Under $40/Month',   href: '/tracks/ai-business-zero-budget/zero-budget-stack/ai-tool-stack-budget', type: 'lesson', note: 'The stack that passes this lesson\'s framework' },
    { label: 'Free-Tier Infrastructure Architecture', href: '/tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture', type: 'lesson' },
  ],

  // ── AI for Students ──────────────────────────────────────────────
  'ai-learning-reality': [
    { label: 'Prompting Fundamentals for Students', href: '/tracks/ai-for-students/learning-acceleration/ai-prompting-fundamentals', type: 'lesson', note: 'Next: how to actually ask for the AI help that accelerates learning' },
    { label: 'Spotting Hallucinations & Verifying AI Output', href: '/tracks/ai-for-students/research-writing/verifying-ai-output', type: 'lesson', note: 'Fluent answers can still be wrong' },
    { label: 'Writing with AI as a Partner, Not a Ghost', href: '/tracks/ai-for-students/research-writing/ai-writing-partner', type: 'lesson' },
  ],

  'ai-prompting-fundamentals': [
    { label: 'AI for Learning: What It Accelerates and What It Harms', href: '/tracks/ai-for-students/learning-acceleration/ai-learning-reality', type: 'lesson', note: 'When to use these prompts — and when not to' },
    { label: 'Spotting Hallucinations & Verifying AI Output', href: '/tracks/ai-for-students/research-writing/verifying-ai-output', type: 'lesson', note: 'Good prompts still produce confident errors' },
    { label: 'AI-Assisted Research Workflow for Students', href: '/tracks/ai-for-students/research-writing/research-workflow-student', type: 'playbook', note: 'Put prompting to work in real research' },
  ],

  'verifying-ai-output': [
    { label: 'AI-Assisted Research Workflow for Students', href: '/tracks/ai-for-students/research-writing/research-workflow-student', type: 'playbook', note: 'Where citation verification fits the full pipeline' },
    { label: 'Writing with AI as a Partner, Not a Ghost', href: '/tracks/ai-for-students/research-writing/ai-writing-partner', type: 'lesson' },
    { label: 'Prompting Fundamentals for Students', href: '/tracks/ai-for-students/learning-acceleration/ai-prompting-fundamentals', type: 'lesson', note: 'Prompts that make the model flag its own uncertainty' },
    { label: 'Maintaining Citation Integrity with AI', href: '/tracks/ai-for-students/research-writing/citation-integrity', type: 'lesson', note: 'The citation-specific deep dive' },
  ],

  'research-workflow-student': [
    { label: 'Spotting Hallucinations & Verifying AI Output', href: '/tracks/ai-for-students/research-writing/verifying-ai-output', type: 'lesson', note: 'The verification skill this workflow depends on' },
    { label: 'Writing with AI as a Partner, Not a Ghost', href: '/tracks/ai-for-students/research-writing/ai-writing-partner', type: 'lesson', note: 'Turn verified research into writing that\'s yours' },
    { label: 'Prompting Fundamentals for Students', href: '/tracks/ai-for-students/learning-acceleration/ai-prompting-fundamentals', type: 'lesson' },
    { label: 'Maintaining Citation Integrity with AI', href: '/tracks/ai-for-students/research-writing/citation-integrity', type: 'lesson', note: 'Verify every reference before you cite it' },
  ],

  'ai-writing-partner': [
    { label: 'AI-Assisted Research Workflow for Students', href: '/tracks/ai-for-students/research-writing/research-workflow-student', type: 'playbook', note: 'Get the material before you write' },
    { label: 'Spotting Hallucinations & Verifying AI Output', href: '/tracks/ai-for-students/research-writing/verifying-ai-output', type: 'lesson', note: 'Verify quotes and citations before they reach your draft' },
    { label: 'Maintaining Citation Integrity with AI', href: '/tracks/ai-for-students/research-writing/citation-integrity', type: 'lesson', note: 'Cite AI use + verify every reference' },
  ],

  'citation-integrity': [
    { label: 'Spotting Hallucinations & Verifying AI Output', href: '/tracks/ai-for-students/research-writing/verifying-ai-output', type: 'lesson', note: 'The broader verification skill this builds on' },
    { label: 'AI-Assisted Research Workflow for Students', href: '/tracks/ai-for-students/research-writing/research-workflow-student', type: 'playbook', note: 'Where citation checks fit the full pipeline' },
    { label: 'Writing with AI as a Partner, Not a Ghost', href: '/tracks/ai-for-students/research-writing/ai-writing-partner', type: 'lesson', note: 'Disclosure norms for AI-assisted writing' },
  ],

  'first-organic-traffic-system': [
    { label: 'Google Search Console Setup',     href: '/tracks/ai-business-zero-budget/zero-budget-stack/google-search-console-setup', type: 'playbook', note: 'Measure the traffic system you build' },
    { label: 'Google Analytics + Data Thinking', href: '/tracks/ai-business-zero-budget/zero-budget-stack/google-analytics-data-thinking', type: 'lesson' },
    { label: 'GEO vs SEO: What Actually Changed', href: '/tracks/geo-ai-search/ai-search-mechanics/geo-vs-seo', type: 'lesson', note: 'AI search is the emerging layer above organic' },
    { label: 'Content Systems Thinking',        href: '/tracks/ai-content-distribution/content-architecture/content-systems-thinking', type: 'lesson' },
  ],

  // ── GEO / AI Search Mechanics ────────────────────────────────

  'geo-vs-seo': [
    { label: 'Content Systems Thinking',        href: '/tracks/ai-content-distribution/content-architecture/content-systems-thinking', type: 'lesson', note: 'Build the content system GEO requires' },
    { label: 'Your First Organic Traffic System', href: '/tracks/ai-business-zero-budget/zero-budget-stack/first-organic-traffic-system', type: 'lesson' },
    { label: 'Google Search Console Setup',     href: '/tracks/ai-business-zero-budget/zero-budget-stack/google-search-console-setup', type: 'playbook', note: 'Measure organic before optimizing for GEO' },
  ],

  // ── AI Automation / Architecture ─────────────────────────────

  'pipeline-design': [
    { label: 'Content Patching System',         href: '/tracks/claude-code-operator/wordpress-rest-api/content-patching-system', type: 'playbook', note: 'This pattern applied to WordPress' },
    { label: 'WordPress REST API Automation',   href: '/playbooks/wp-rest-api-automation-playbook', type: 'playbook' },
    { label: 'Debugging Methodology',           href: '/tracks/claude-code-operator/debugging-recovery/debugging-methodology', type: 'lesson', note: 'Debug automation pipelines systematically' },
  ],

  // ── AI Content Distribution / Architecture ───────────────────

  'content-systems-thinking': [
    { label: 'Your First Organic Traffic System', href: '/tracks/ai-business-zero-budget/zero-budget-stack/first-organic-traffic-system', type: 'lesson', note: 'Implementation of the system described here' },
    { label: 'GEO vs SEO: What Actually Changed', href: '/tracks/geo-ai-search/ai-search-mechanics/geo-vs-seo', type: 'lesson', note: 'AI search layer on top of the content system' },
    { label: 'Claude + WordPress Operational Workflow', href: '/tracks/ai-business-zero-budget/zero-budget-stack/claude-wordpress-workflow', type: 'playbook', note: 'AI-assisted content production workflow' },
  ],
}

// ─────────────────────────────────────────────────────────────
// Track-level defaults
// Used when a specific lesson ID has no entry — ensures every
// lesson gets at least "related" content pointing to its track.
// ─────────────────────────────────────────────────────────────

export const TRACK_DEFAULTS: Record<string, RelatedItem[]> = {
  'claude-code-operator': [
    { label: 'Failure Archive',                 href: '/failures', type: 'failure', note: 'Real production failures from this stack' },
    { label: 'WordPress REST API Automation',   href: '/playbooks/wp-rest-api-automation-playbook', type: 'playbook' },
  ],
  'ai-business-zero-budget': [
    { label: 'GEO + AI Search Systems',         href: '/tracks/geo-ai-search', type: 'track', note: 'Distribution through AI search' },
    { label: 'AI Content + Distribution',       href: '/tracks/ai-content-distribution', type: 'track', note: 'Scale the content operation' },
  ],
  'geo-ai-search': [
    { label: 'Your First Organic Traffic System', href: '/tracks/ai-business-zero-budget/zero-budget-stack/first-organic-traffic-system', type: 'lesson' },
    { label: 'Content Systems Thinking',        href: '/tracks/ai-content-distribution/content-architecture/content-systems-thinking', type: 'lesson' },
  ],
  'ai-automation-systems': [
    { label: 'Content Patching System',         href: '/tracks/claude-code-operator/wordpress-rest-api/content-patching-system', type: 'playbook', note: 'Proven automation pattern' },
    { label: 'Claude Code Operator track',      href: '/tracks/claude-code-operator', type: 'track', note: 'Broader operator context' },
  ],
  'ai-content-distribution': [
    { label: 'GEO + AI Search Systems',         href: '/tracks/geo-ai-search', type: 'track', note: 'AI search visibility layer' },
    { label: 'Claude + WordPress Operational Workflow', href: '/tracks/ai-business-zero-budget/zero-budget-stack/claude-wordpress-workflow', type: 'playbook' },
  ],
}

// ─────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────

export function getRelatedContent(lessonId: string, trackId: string): RelatedItem[] {
  const specific = RELATED_CONTENT[lessonId] ?? []
  if (specific.length > 0) return specific
  return TRACK_DEFAULTS[trackId] ?? []
}
