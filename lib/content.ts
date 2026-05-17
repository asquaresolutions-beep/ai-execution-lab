import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ContentSection = 'docs' | 'systems' | 'labs' | 'case-studies'

export interface ContentFrontmatter {
  title: string
  description: string
  date: string          // ISO 8601: "2026-05-17"
  updated?: string      // ISO 8601, if different from date
  tags?: string[]
  status?: 'draft' | 'published' | 'archived'
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  // Docs-specific
  section?: string      // sidebar grouping
  // Systems-specific
  stack?: string[]      // ["WordPress", "LiteSpeed", "Elementor"]
  // Labs-specific
  hypothesis?: string
  result?: 'confirmed' | 'refuted' | 'inconclusive' | 'ongoing'
  // Case studies
  impact?: string       // brief impact summary e.g. "Resolved 90px → 28px heading render"
}

export interface ContentItem {
  slug: string
  section: ContentSection
  frontmatter: ContentFrontmatter
  readingTime: string
  content: string       // raw MDX string
}

export interface ContentMeta {
  slug: string
  section: ContentSection
  frontmatter: ContentFrontmatter
  readingTime: string
  // no content — for index/listing pages
}

// ─────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────

const CONTENT_ROOT = path.join(process.cwd(), 'content')

function sectionDir(section: ContentSection): string {
  return path.join(CONTENT_ROOT, section)
}

// ─────────────────────────────────────────────────────────────
// Read helpers
// ─────────────────────────────────────────────────────────────

function slugFromFilename(filename: string): string {
  return filename.replace(/\.mdx?$/, '')
}

function parseFrontmatter(raw: string, slug: string, section: ContentSection): ContentMeta {
  const { data, content } = matter(raw)
  const fm = data as ContentFrontmatter
  const stats = readingTime(content)

  // Defaults
  fm.status = fm.status ?? 'published'

  return {
    slug,
    section,
    frontmatter: fm,
    readingTime: stats.text,
  }
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Get metadata for all items in a section (no content body).
 * Used for index/listing pages.
 */
export function getAllMeta(section: ContentSection): ContentMeta[] {
  const dir = sectionDir(section)

  if (!fs.existsSync(dir)) return []

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))

  const items = files.map((file) => {
    const slug = slugFromFilename(file)
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
    return parseFrontmatter(raw, slug, section)
  })

  // Filter out drafts in production, sort by date desc
  return items
    .filter((item) =>
      process.env.NODE_ENV === 'development' || item.frontmatter.status !== 'draft'
    )
    .sort((a, b) =>
      new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
    )
}

/**
 * Get a single item with its full MDX content.
 */
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

  return {
    slug,
    section,
    frontmatter: fm,
    readingTime: stats.text,
    content,
  }
}

/**
 * Get all slugs in a section — used for generateStaticParams.
 */
export function getAllSlugs(section: ContentSection): string[] {
  const dir = sectionDir(section)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map(slugFromFilename)
}

/**
 * Get a flat list of recent items across ALL sections.
 */
export function getRecentItems(limit = 6): ContentMeta[] {
  const sections: ContentSection[] = ['systems', 'labs', 'case-studies', 'docs']
  return sections
    .flatMap((s) => getAllMeta(s))
    .sort((a, b) =>
      new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
    )
    .slice(0, limit)
}
