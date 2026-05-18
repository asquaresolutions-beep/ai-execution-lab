/**
 * lib/content-templates.ts
 * Content template registry for the rapid publishing system.
 *
 * Templates live in /templates/ at the repo root as MDX stubs.
 * This registry provides metadata for the /publish page and ops dashboard.
 *
 * Usage: copy the template file to the appropriate content/ directory,
 * rename to [slug].mdx, fill in placeholders, commit, push.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type TemplateType =
  | 'failure-report'
  | 'execution-log'
  | 'deployment-journal'
  | 'seo-experiment'
  | 'case-study'
  | 'ai-workflow'

export interface ContentTemplate {
  id:              TemplateType
  title:           string
  description:     string
  /** Destination content section */
  section:         string
  /** Path to the template file (relative to repo root) */
  templatePath:    string
  /** Target time from session to published: "30 min", "2 h", etc. */
  captureTarget:   string
  /** Minimum viable publish bar — what must be true before hitting git push */
  minimumBar:      string[]
  /** Example commit message pattern */
  commitPattern:   string
  /** When to reach for this template */
  triggers:        string[]
}

// ─────────────────────────────────────────────────────────────
// Template Registry
// ─────────────────────────────────────────────────────────────

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    id:           'failure-report',
    title:        'Failure Report',
    description:  'Document a production incident — root cause, resolution timeline, prevention steps, confidence score.',
    section:      'failures',
    templatePath: 'templates/failure-report.mdx',
    captureTarget: '30 min',
    minimumBar: [
      'Root cause stated in one specific sentence',
      'Resolution timeline with minutes (not "a few hours")',
      'At least 3 prevention steps that are specific and actionable',
      'severity and failure_status frontmatter fields filled',
    ],
    commitPattern: 'content: failure report — [slug]',
    triggers: [
      'Any production incident, regardless of severity',
      'Any debugging session that took more than 15 minutes',
      'Any error you had to search for that had no clear answer online',
      'Any configuration mistake that caused unexpected behavior',
    ],
  },
  {
    id:           'execution-log',
    title:        'Execution Log',
    description:  'Record a session — what was done, what was decided, what was shipped, what was left open.',
    section:      'logs',
    templatePath: 'templates/execution-log.mdx',
    captureTarget: '20 min',
    minimumBar: [
      'Session duration noted',
      'Outcome stated (what shipped or was resolved)',
      'Key decisions documented',
      'Next actions clear',
    ],
    commitPattern: 'content: execution log — YYYY-MM-DD',
    triggers: [
      'Any work session longer than 1 hour',
      'Any session where a meaningful decision was made',
      'Any session where something was shipped to production',
      'Any monthly operations review for ecosystem properties',
    ],
  },
  {
    id:           'deployment-journal',
    title:        'Deployment Journal',
    description:  'Record a production deployment — what was deployed, pre-deploy checklist, build outcome, incidents.',
    section:      'logs',
    templatePath: 'templates/deployment-journal.mdx',
    captureTarget: '15 min',
    minimumBar: [
      'Commit hash referenced',
      'Pre-deploy checklist completed',
      'Build duration and page count noted',
      'Post-deploy verification documented',
    ],
    commitPattern: 'content: deployment journal — YYYY-MM-DD',
    triggers: [
      'Any significant production deployment (new features, architecture changes)',
      'Any deployment with incidents or unexpected behavior',
      'First deployment of a new project or major version',
    ],
  },
  {
    id:           'seo-experiment',
    title:        'SEO/GEO Experiment',
    description:  'Document an SEO or GEO experiment — hypothesis, baseline metrics, implementation, measured results.',
    section:      'labs',
    templatePath: 'templates/seo-experiment.mdx',
    captureTarget: '45 min',
    minimumBar: [
      'Hypothesis stated in If/Then/Because format',
      'Baseline metrics captured before any changes',
      'Implementation documented (what exactly changed)',
      'Measurement window defined (when to check results)',
    ],
    commitPattern: 'content: seo experiment — [slug]',
    triggers: [
      'Any on-page SEO change to a key page',
      'Any structured data addition or modification',
      'Any internal linking strategy change',
      'Any content rewrite targeting a specific query',
      'Any GEO optimization attempt',
    ],
  },
  {
    id:           'case-study',
    title:        'Case Study',
    description:  'Document a complete build or decision arc — context, architecture decision, execution, outcome, learnings.',
    section:      'case-studies',
    templatePath: 'templates/case-study.mdx',
    captureTarget: '2 h',
    minimumBar: [
      'Architecture decision documented with options considered',
      'At least one incident during build documented',
      'Measurable outcome stated (before/after)',
      'Honest "what I would do differently" section',
    ],
    commitPattern: 'content: case study — [slug]',
    triggers: [
      'Completion of a new product or feature build',
      'A significant architecture change with measurable outcome',
      'A complete debugging arc from problem to resolution',
      'A meaningful operational improvement with before/after evidence',
    ],
  },
  {
    id:           'ai-workflow',
    title:        'AI Workflow',
    description:  'Document a reusable AI-assisted workflow — inputs, outputs, prompt templates, failure modes.',
    section:      'docs',
    templatePath: 'templates/ai-workflow.mdx',
    captureTarget: '60 min',
    minimumBar: [
      'Input and output clearly defined',
      'At least one prompt template included (exact text)',
      'Known failure modes documented',
      'Time saved estimated vs. manual approach',
    ],
    commitPattern: 'content: ai workflow — [slug]',
    triggers: [
      'Any AI-assisted workflow you run more than twice',
      'Any Claude Code workflow that produced consistently good results',
      'Any prompt pattern that solved a recurring problem',
      'Any AI-assisted publishing or operational workflow',
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Query API
// ─────────────────────────────────────────────────────────────

const templateById = new Map(CONTENT_TEMPLATES.map(t => [t.id, t]))

export function getTemplateById(id: TemplateType): ContentTemplate | null {
  return templateById.get(id) ?? null
}

export function getTemplatesBySection(section: string): ContentTemplate[] {
  return CONTENT_TEMPLATES.filter(t => t.section === section)
}

/**
 * Get the capture priority order:
 * failure-report and execution-log are always fastest to publish,
 * so they're always top of the publishing queue.
 */
export function getCapturePriorityOrder(): ContentTemplate[] {
  const ORDER: TemplateType[] = [
    'failure-report',
    'execution-log',
    'deployment-journal',
    'seo-experiment',
    'case-study',
    'ai-workflow',
  ]
  return ORDER.map(id => templateById.get(id)!).filter(Boolean)
}
