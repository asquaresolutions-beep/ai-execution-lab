import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ContentSection = 'docs' | 'systems' | 'labs' | 'case-studies' | 'playbooks' | 'failures'

export interface ContentFrontmatter {
  title: string
  description: string
  date: string          // ISO 8601: "2026-05-17"
  updated?: string
  tags?: string[]
  status?: 'draft' | 'published' | 'archived'
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
  failure_type?: 'build' | 'runtime' | 'deployment' | 'data' | 'performance' | 'dependency'
  project?: string
  resolution_time?: string
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

/** Metadata for all published items in a section, sorted by date desc. */
export function getAllMeta(section: ContentSection): ContentMeta[] {
  const dir = sectionDir(section)
  if (!fs.existsSync(dir)) return []

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))

  return files
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
  const sections: ContentSection[] = ['playbooks', 'systems', 'labs', 'case-studies', 'docs', 'failures']
  return sections
    .flatMap((s) => getAllMeta(s))
    .sort((a, b) =>
      new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
    )
    .slice(0, limit)
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
  const sections: ContentSection[] = ['docs', 'systems', 'labs', 'case-studies', 'playbooks', 'failures']
  const result = {} as Record<ContentSection, number>
  for (const s of sections) {
    result[s] = getAllMeta(s).length
  }
  return result
}
