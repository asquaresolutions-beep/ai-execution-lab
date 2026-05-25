/**
 * lib/relationship-index.ts
 *
 * Build-time reverse relationship index for the AI Execution Lab operational graph.
 *
 * Scans all content frontmatter at build time and constructs a complete bidirectional
 * relationship map. The functions here supersede the forward-only relationship
 * functions previously in lib/content.ts.
 *
 * Architecture:
 * - Forward relationships: declared in each item's own frontmatter
 * - Reverse relationships: discovered by scanning all items for references to a target
 * - Both directions are merged and de-duplicated by the public query API
 *
 * The singleton index is built once per Node.js process (per Next.js build).
 * getAllMeta() is memoized in lib/content.ts, so this adds negligible overhead.
 */

import { getAllMeta, type ContentMeta, type ContentSection } from './content'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const ALL_SECTIONS: ContentSection[] = [
  'docs', 'systems', 'labs', 'case-studies', 'playbooks', 'failures', 'logs',
]

/**
 * Maps each frontmatter relationship field to its target section.
 * linked_incidents is handled separately (cross-section: failures + logs).
 */
const FIELD_TO_SECTION: Record<string, ContentSection> = {
  related_failures:     'failures',
  related_logs:         'logs',
  related_docs:         'docs',
  related_playbooks:    'playbooks',
  related_case_studies: 'case-studies',
}

// ─────────────────────────────────────────────────────────────
// Index types
// ─────────────────────────────────────────────────────────────

/**
 * reverseRelated[targetSection][targetSlug] → ContentMeta[]
 * Items from ANY section that declare a typed relationship pointing to (targetSection, targetSlug).
 * e.g. ['failures']['edge-runtime'] = [log-A, case-study-B] because those items
 * have `related_failures: ['edge-runtime']` in their frontmatter.
 */
type SectionSlugMap = Map<string, ContentMeta[]>
type ReverseRelatedIndex = Map<ContentSection, SectionSlugMap>

/**
 * reverseIncidents[targetSlug] → ContentMeta[]
 * Items that declare this slug in their `linked_incidents` field.
 */
type ReverseIncidentsIndex = Map<string, ContentMeta[]>

// ─────────────────────────────────────────────────────────────
// Singleton — built once per build process
// ─────────────────────────────────────────────────────────────

let _reverseRelated: ReverseRelatedIndex | null = null
let _reverseIncidents: ReverseIncidentsIndex | null = null

function buildIndex(): void {
  const related: ReverseRelatedIndex = new Map()
  const incidents: ReverseIncidentsIndex = new Map()

  // Pre-init section maps
  for (const s of ALL_SECTIONS) {
    related.set(s, new Map())
  }

  for (const section of ALL_SECTIONS) {
    for (const item of getAllMeta(section)) {
      const fm = item.frontmatter as unknown as Record<string, unknown>

      // Process typed relationship fields
      for (const [field, targetSection] of Object.entries(FIELD_TO_SECTION)) {
        const slugs = fm[field]
        if (!Array.isArray(slugs)) continue

        const sectionMap = related.get(targetSection)!
        for (const targetSlug of slugs as string[]) {
          if (!sectionMap.has(targetSlug)) sectionMap.set(targetSlug, [])
          sectionMap.get(targetSlug)!.push(item)
        }
      }

      // Process linked_incidents (cross-section: targets can be failures or logs)
      const linkedSlugs = (fm['linked_incidents'] as string[] | undefined) ?? []
      for (const targetSlug of linkedSlugs) {
        if (!incidents.has(targetSlug)) incidents.set(targetSlug, [])
        incidents.get(targetSlug)!.push(item)
      }
    }
  }

  _reverseRelated  = related
  _reverseIncidents = incidents
}

function ensureIndex(): void {
  if (_reverseRelated === null) buildIndex()
}

// ─────────────────────────────────────────────────────────────
// Low-level reverse queries
// ─────────────────────────────────────────────────────────────

/**
 * Items from ANY section that declare a relationship pointing to (targetSection, targetSlug).
 * These are the reverse-discovered references — items that weren't declared by the target itself.
 */
export function getReverseRelated(
  targetSection: ContentSection,
  targetSlug: string,
): ContentMeta[] {
  ensureIndex()
  return _reverseRelated!.get(targetSection)?.get(targetSlug) ?? []
}

/**
 * Items that list the given slug in their `linked_incidents` field.
 */
export function getReverseIncidents(targetSlug: string): ContentMeta[] {
  ensureIndex()
  return _reverseIncidents!.get(targetSlug) ?? []
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Deduplicate ContentMeta array by section:slug key. */
function dedupMeta(items: ContentMeta[]): ContentMeta[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.section}:${item.slug}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Resolve a list of slugs to ContentMeta objects within a section. */
function resolveInSection(section: ContentSection, slugs: string[] = []): ContentMeta[] {
  const all = getAllMeta(section)
  return slugs
    .map((s) => all.find((m) => m.slug === s))
    .filter((m): m is ContentMeta => m !== undefined)
}

// ─────────────────────────────────────────────────────────────
// Public bidirectional API
// ─────────────────────────────────────────────────────────────

/**
 * Cross-section related content — bidirectional.
 *
 * Merges:
 * 1. Forward: relationships declared in this item's own frontmatter
 * 2. Reverse: other items that declare a relationship pointing to this item
 *
 * Result is grouped by target section and de-duplicated.
 * Excludes self-references and items in the same section if they aren't
 * explicitly cross-section related.
 */
export function getCrossRelated(
  section: ContentSection,
  slug: string,
): {
  failures:     ContentMeta[]
  logs:         ContentMeta[]
  case_studies: ContentMeta[]
  docs:         ContentMeta[]
  playbooks:    ContentMeta[]
} {
  const selfMeta = getAllMeta(section).find((m) => m.slug === slug)
  const fm = selfMeta?.frontmatter

  // Forward relationships from this item's frontmatter
  const fwdFailures    = resolveInSection('failures',     fm?.related_failures)
  const fwdLogs        = resolveInSection('logs',         fm?.related_logs)
  const fwdCaseStudies = resolveInSection('case-studies', fm?.related_case_studies)
  const fwdDocs        = resolveInSection('docs',         fm?.related_docs)
  const fwdPlaybooks   = resolveInSection('playbooks',    fm?.related_playbooks)

  // Reverse relationships — items from any section that reference THIS item
  const allReverse = getReverseRelated(section, slug)
  // Filter out self (same section + slug should never appear, but guard anyway)
  const reverse = allReverse.filter((m) => !(m.section === section && m.slug === slug))

  // Group reverse items by their own section
  const revFailures    = reverse.filter((m) => m.section === 'failures')
  const revLogs        = reverse.filter((m) => m.section === 'logs')
  const revCaseStudies = reverse.filter((m) => m.section === 'case-studies')
  const revDocs        = reverse.filter((m) => m.section === 'docs')
  const revPlaybooks   = reverse.filter((m) => m.section === 'playbooks')

  return {
    failures:     dedupMeta([...fwdFailures,    ...revFailures]),
    logs:         dedupMeta([...fwdLogs,         ...revLogs]),
    case_studies: dedupMeta([...fwdCaseStudies,  ...revCaseStudies]),
    docs:         dedupMeta([...fwdDocs,          ...revDocs]),
    playbooks:    dedupMeta([...fwdPlaybooks,     ...revPlaybooks]),
  }
}

/**
 * Linked incidents — bidirectional.
 *
 * Merges:
 * 1. Forward: slugs in this item's own `linked_incidents` field
 * 2. Reverse: items that list this slug in their `linked_incidents` field
 *
 * Searches across failures + logs for slug resolution.
 * De-duplicated and self-filtered.
 */
export function getLinkedIncidents(
  section: ContentSection,
  slug: string,
): ContentMeta[] {
  const selfMeta = getAllMeta(section).find((m) => m.slug === slug)
  const fwdSlugs = selfMeta?.frontmatter.linked_incidents ?? []

  // Forward: resolve slugs across failures + logs pool
  const pool = [...getAllMeta('failures'), ...getAllMeta('logs')]
  const forward = fwdSlugs
    .map((s) => pool.find((m) => m.slug === s))
    .filter((m): m is ContentMeta => m !== undefined)

  // Reverse: items that reference THIS slug in their linked_incidents
  const reverse = getReverseIncidents(slug)
    .filter((m) => !(m.section === section && m.slug === slug))

  return dedupMeta([...forward, ...reverse])
}

// ─────────────────────────────────────────────────────────────
// Graph summary — for /ops dashboard
// ─────────────────────────────────────────────────────────────

/** Count of reverse relationships discovered across the entire graph. */
export function getReverseRelationshipCount(): number {
  ensureIndex()
  let count = 0
  for (const sectionMap of _reverseRelated!.values()) {
    for (const items of sectionMap.values()) {
      count += items.length
    }
  }
  return count
}

/**
 * Orphaned content detector — items with no forward OR reverse relationships.
 * Useful for identifying isolated content that hasn't been wired into the graph.
 */
export function getOrphanedItems(section: ContentSection): ContentMeta[] {
  ensureIndex()
  const relFields: (keyof typeof FIELD_TO_SECTION)[] = Object.keys(FIELD_TO_SECTION)
  const sectionMap = _reverseRelated!.get(section)!

  return getAllMeta(section).filter((item) => {
    const fm = item.frontmatter as unknown as Record<string, unknown>

    // Check forward declarations
    const hasForward = relFields.some((field) => {
      const v = fm[field]
      return Array.isArray(v) && v.length > 0
    }) || ((fm['linked_incidents'] as string[] | undefined)?.length ?? 0) > 0

    // Check reverse references
    const hasReverse = (sectionMap.get(item.slug)?.length ?? 0) > 0

    return !hasForward && !hasReverse
  })
}
