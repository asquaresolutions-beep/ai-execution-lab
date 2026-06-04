import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ContentSection = 'docs' | 'systems' | 'labs' | 'case-studies' | 'playbooks' | 'failures' | 'logs'

export interface ContentFrontmatter {
  title: string
  description: string
  date: string          // ISO 8601: "2026-05-17"
  updated?: string
  tags?: string[]
  status?: 'draft' | 'published' | 'archived'
  noindex?: boolean        // true for internal planning docs — suppresses search indexing
  // Docs-specific
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  section?: string      // sidebar grouping
  // Systems-specific
  stack?: string[]
  // Labs-specific
  hypothesis?: string
  result?: 'confirmed' | 'refuted' | 'inconclusive' | 'ongoing'
  // Case studies
  impact?: string
  // Playbooks-specific
  goal?: string         // what this playbook achieves
  prerequisites?: string[]
  estimated_time?: string
  // Failures-specific
  severity?: 'low' | 'medium' | 'high' | 'critical'
  failure_status?: 'open' | 'investigating' | 'resolved'
  failure_type?: 'build' | 'runtime' | 'deployment' | 'data' | 'performance' | 'dependency' | 'configuration' | 'authentication'
  project?: string
  resolution_time?: string
  // Logs-specific
  log_type?: 'daily' | 'weekly' | 'deployment' | 'debug' | 'experiment' | 'release' | 'operations'
  duration?: string    // e.g. "2h 15m"
  outcome?: string     // one-line result
  // Failure-specific operational fields
  affected_systems?: string[]  // systems impacted by this failure (e.g. ["firebase-functions", "vercel"])
  repeat_risk?: 'low' | 'medium' | 'high'  // likelihood of recurrence
  recovery_complexity?: string // e.g. "5 minutes" or "requires full redeploy"
  deployment_risk?: 'low' | 'medium' | 'high'
  time_to_detect?: string      // e.g. "immediate" or "~2 hours"
  systems_touched?: string[]   // broader ecosystem touch points
  deployment_ref?: string      // reference to the deployment log slug
  // Cross-section relationship fields
  related_failures?: string[]  // slugs of related failure entries
  related_logs?: string[]      // slugs of related execution log entries
  related_case_studies?: string[]  // slugs of related case studies
  related_docs?: string[]      // slugs of related docs
  related_playbooks?: string[] // slugs of related playbooks
  linked_incidents?: string[]  // slugs of incidents that share root cause or context
  // Authorship fields
  author?: string
  author_role?: string
  // Editorial flags + FAQ
  featured?: boolean
  faqs?: { question: string; answer: string }[]
  // GEO / evidence fields
  evidence_images?: string[]   // paths or URLs to evidence screenshots/assets
  external_refs?: string[]     // external citations used in the content
}

export interface ContentItem {
  slug: string
  section: ContentSection
  frontmatter: ContentFrontmatter
  readingTime: string
  content: string
}

export interface ContentMeta {
  slug: string
  section: ContentSection
  frontmatter: ContentFrontmatter
  readingTime: string
}

// ─────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────

const CONTENT_ROOT = path.join(process.cwd(), 'content')

function sectionDir(section: ContentSection): string {
  return path.join(CONTENT_ROOT, section)
}

// ─────────────────────────────────────────────────────────────
// Build-time memoization
// One Node.js process per build — safe to cache indefinitely.
// ─────────────────────────────────────────────────────────────
const _metaCache = new Map<ContentSection, ContentMeta[]>()

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function slugFromFilename(filename: string): string {
  return filename.replace(/\.mdx?$/, '')
}

function parseMeta(raw: string, slug: string, section: ContentSection): ContentMeta {
  const { data, content } = matter(raw)
  const fm = data as ContentFrontmatter
  const stats = readingTime(content)
  fm.status = fm.status ?? 'published'
  return { slug, section, frontmatter: fm, readingTime: stats.text }
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/** Metadata for all published items in a section, sorted by date desc. Memoized per process. */
export function getAllMeta(section: ContentSection): ContentMeta[] {
  if (_metaCache.has(section)) return _metaCache.get(section)!

  const dir = sectionDir(section)
  if (!fs.existsSync(dir)) {
    _metaCache.set(section, [])
    return []
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))

  const result = files
    .map((file) => {
      const slug = slugFromFilename(file)
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
      return parseMeta(raw, slug, section)
    })
    .filter((item) =>
      process.env.NODE_ENV === 'development' || item.frontmatter.status !== 'draft'
    )
    .sort((a, b) =>
      new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
    )

  _metaCache.set(section, result)
  return result
}

/** Single item with full MDX content. */
export function getItem(section: ContentSection, slug: string): ContentItem | null {
  const dir = sectionDir(section)
  const mdxPath = path.join(dir, `${slug}.mdx`)
  const mdPath  = path.join(dir, `${slug}.md`)
  const filePath = fs.existsSync(mdxPath) ? mdxPath : fs.existsSync(mdPath) ? mdPath : null
  if (!filePath) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  const fm = data as ContentFrontmatter
  const stats = readingTime(content)
  fm.status = fm.status ?? 'published'

  return { slug, section, frontmatter: fm, readingTime: stats.text, content }
}

/** All slugs in a section — for generateStaticParams. */
export function getAllSlugs(section: ContentSection): string[] {
  const dir = sectionDir(section)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map(slugFromFilename)
}

/** Recent items across ALL sections, sorted by date desc. */
export function getRecentItems(limit = 6): ContentMeta[] {
  const sections: ContentSection[] = ['playbooks', 'systems', 'labs', 'case-studies', 'docs', 'failures', 'logs']
  return sections
    .flatMap((s) => getAllMeta(s))
    .sort((a, b) =>
      new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
    )
    .slice(0, limit)
}

const ALL_SECTIONS: ContentSection[] = ['playbooks', 'systems', 'labs', 'case-studies', 'docs', 'failures', 'logs']

/** All published items across every section, newest first. */
export function getAllItems(): ContentMeta[] {
  return ALL_SECTIONS.flatMap((s) => getAllMeta(s))
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())
}

/** Featured items (frontmatter.featured === true), newest first. */
export function getFeaturedItems(limit = 6): ContentMeta[] {
  return getAllItems().filter((i) => i.frontmatter.featured === true).slice(0, limit)
}

/**
 * Popular items via deterministic fallback ranking (no analytics needed):
 *   1) featured, 2) most internally-linked (inbound related/linked refs), 3) recent.
 */
export function getPopularItems(limit = 6): ContentMeta[] {
  const all = getAllItems()
  const inbound = new Map<string, number>()
  const relKeys = ['related_docs', 'related_failures', 'related_logs', 'related_case_studies', 'related_playbooks', 'linked_incidents'] as const
  for (const item of all) {
    for (const k of relKeys) {
      const refs = (item.frontmatter as unknown as Record<string, unknown>)[k] as string[] | undefined
      if (Array.isArray(refs)) for (const slug of refs) inbound.set(slug, (inbound.get(slug) ?? 0) + 1)
    }
  }
  return all
    .map((i) => ({ i, score: (i.frontmatter.featured ? 1000 : 0) + (inbound.get(i.slug) ?? 0) * 10, date: new Date(i.frontmatter.date).getTime() }))
    .sort((a, b) => b.score - a.score || b.date - a.date)
    .map((x) => x.i)
    .slice(0, limit)
}

/** All items authored by a given author name (case-insensitive). */
export function getItemsByAuthor(name: string): ContentMeta[] {
  const n = name.toLowerCase()
  return getAllItems().filter((i) => (i.frontmatter.author ?? '').toLowerCase() === n)
}

/** Previous and next items within a section — for article navigation. */
export function getNeighbors(
  section: ContentSection,
  slug: string
): { prev: ContentMeta | null; next: ContentMeta | null } {
  const items = getAllMeta(section)
  const idx   = items.findIndex((i) => i.slug === slug)
  return {
    prev: idx > 0                ? items[idx - 1] : null,
    next: idx < items.length - 1 ? items[idx + 1] : null,
  }
}

/** Related items within a section — matched by tag overlap, sorted by overlap count then date. */
export function getRelatedItems(
  section: ContentSection,
  slug: string,
  limit = 3,
): ContentMeta[] {
  const items = getAllMeta(section).filter((i) => i.slug !== slug)
  const source = getAllMeta(section).find((i) => i.slug === slug)
  const sourceTags = new Set(source?.frontmatter.tags ?? [])

  if (sourceTags.size === 0) return items.slice(0, limit)

  return items
    .map((item) => {
      const overlap = (item.frontmatter.tags ?? []).filter((t) => sourceTags.has(t)).length
      return { item, overlap }
    })
    .sort((a, b) => b.overlap - a.overlap || 0)
    .map(({ item }) => item)
    .slice(0, limit)
}

/** Count of items per section — for dashboard stats. */
export function getSectionCounts(): Record<ContentSection, number> {
  const sections: ContentSection[] = ['docs', 'systems', 'labs', 'case-studies', 'playbooks', 'failures', 'logs']
  const result = {} as Record<ContentSection, number>
  for (const s of sections) {
    result[s] = getAllMeta(s).length
  }
  return result
}

// getCrossRelated and getLinkedIncidents have moved to lib/relationship-index.ts
// where they are implemented with full bidirectional reverse-index support.
