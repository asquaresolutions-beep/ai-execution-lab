import { getAllMeta, type ContentSection, type ContentMeta } from './content'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TagEntry {
  tag:   string
  count: number
  items: ContentMeta[]
}

// ─────────────────────────────────────────────────────────────
// All indexed sections
// ─────────────────────────────────────────────────────────────

const SECTIONS: ContentSection[] = [
  'docs', 'systems', 'labs', 'case-studies', 'playbooks', 'failures', 'logs',
]

// ─────────────────────────────────────────────────────────────
// Build tag index — all tags across all sections
// ─────────────────────────────────────────────────────────────

export function buildTagIndex(): TagEntry[] {
  const map = new Map<string, ContentMeta[]>()

  for (const section of SECTIONS) {
    for (const item of getAllMeta(section)) {
      for (const tag of item.frontmatter.tags ?? []) {
        const existing = map.get(tag) ?? []
        map.set(tag, [...existing, item])
      }
    }
  }

  return Array.from(map.entries())
    .map(([tag, items]) => ({
      tag,
      count: items.length,
      items: items.sort(
        (a, b) =>
          new Date(b.frontmatter.date).getTime() -
          new Date(a.frontmatter.date).getTime()
      ),
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** All tag slugs — for generateStaticParams. */
export function getAllTagSlugs(): string[] {
  return buildTagIndex().map((e) => e.tag)
}

/** Items for a single tag. */
export function getTagItems(tag: string): ContentMeta[] {
  return buildTagIndex().find((e) => e.tag === tag)?.items ?? []
}
