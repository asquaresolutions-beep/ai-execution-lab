import { getAllMeta, type ContentSection } from './content'
import { SECTION_META } from './utils'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SearchItem {
  id:          string          // `section/slug`
  title:       string
  description: string
  section:     ContentSection
  slug:        string
  href:        string
  tags:        string[]
  date:        string
  label:       string          // e.g. "DOCS", "LAB"
}

// ─────────────────────────────────────────────────────────────
// Builder — runs on the server (Node.js only)
// ─────────────────────────────────────────────────────────────

const ALL_SECTIONS: ContentSection[] = ['docs', 'systems', 'labs', 'case-studies', 'playbooks']

export function buildSearchIndex(): SearchItem[] {
  return ALL_SECTIONS.flatMap((section) => {
    const meta  = SECTION_META[section]
    const items = getAllMeta(section)

    return items.map((item) => ({
      id:          `${section}/${item.slug}`,
      title:       item.frontmatter.title,
      description: item.frontmatter.description ?? '',
      section,
      slug:        item.slug,
      href:        `${meta.href}/${item.slug}`,
      tags:        item.frontmatter.tags ?? [],
      date:        item.frontmatter.date,
      label:       meta.label,
    }))
  })
}
