/**
 * lib/internal-linking.ts
 *
 * Internal link graph scanner for the AI Execution Lab content corpus.
 *
 * Scans all published MDX files for internal links, builds a directed graph,
 * detects orphaned and weakly-connected pages, and generates specific
 * actionable link suggestions based on tag overlap and semantic proximity.
 *
 * All computation happens at build time — no runtime dependencies.
 */

import fs   from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { getAllMeta, ContentSection } from './content'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PageLinkProfile {
  /** URL path, e.g. "/failures/edge-runtime-deployment-failure" */
  href:         string
  section:      ContentSection
  slug:         string
  title:        string
  tags:         string[]
  /** Slugs this page links OUT to (within the lab) */
  outbound:     string[]
  /** Slugs that link INTO this page */
  inbound:      string[]
  outboundCount: number
  inboundCount:  number
  /** True if inbound === 0 (no page links here) */
  isOrphaned:   boolean
  /** True if inbound < 2 AND outbound < 2 */
  isIsolated:   boolean
  /** Connectivity score 0–100 */
  connectivityScore: number
}

export interface LinkSuggestion {
  /** Specific "add a link from X to Y" instruction */
  fromHref:    string
  fromTitle:   string
  toHref:      string
  toTitle:     string
  reason:      string
  /** e.g. shared tags, related section, semantic match */
  matchType:   'shared-tags' | 'section-bridge' | 'failure-playbook' | 'log-doc' | 'case-study-doc'
  priority:    'high' | 'medium' | 'low'
  sharedTags?: string[]
}

export interface OrphanedPageReport {
  orphaned:  PageLinkProfile[]
  isolated:  PageLinkProfile[]
  /** Pages with inbound > 5 — well-connected hubs */
  hubs:      PageLinkProfile[]
  /** Pages that are sinks (no outbound) */
  sinks:     PageLinkProfile[]
}

export interface LinkGraphSummary {
  totalPages:       number
  totalLinks:       number
  orphanedCount:    number
  isolatedCount:    number
  avgInbound:       number
  avgOutbound:      number
  avgConnectivity:  number
  hubCount:         number
  sinkCount:        number
}

export interface InternalLinkingReport {
  profiles:    PageLinkProfile[]
  suggestions: LinkSuggestion[]
  orphans:     OrphanedPageReport
  summary:     LinkGraphSummary
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS: ContentSection[] = [
  'docs', 'failures', 'logs', 'case-studies', 'playbooks', 'labs', 'systems',
]

const CONTENT_ROOT = path.join(process.cwd(), 'content')

// ─────────────────────────────────────────────────────────────────────────────
// Build-time cache
// ─────────────────────────────────────────────────────────────────────────────

let _cachedReport: InternalLinkingReport | null = null

// ─────────────────────────────────────────────────────────────────────────────
// Link extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract internal hrefs from MDX content.
 * Captures: [text](/section/slug), href="/section/slug", href='/section/slug'
 * Excludes: external URLs, anchor-only links, mailto:
 */
function extractInternalLinks(mdxContent: string): string[] {
  const links = new Set<string>()

  // Markdown link syntax: [text](/path)
  const mdPattern = /\[([^\]]*)\]\((\/[^)#?\s]+)/g
  let m: RegExpExecArray | null
  while ((m = mdPattern.exec(mdxContent)) !== null) {
    links.add(m[2])
  }

  // JSX/HTML href: href="/path" or href='/path'
  const hrefPattern = /href=["'](\/[^"'#?\s]+)["']/g
  while ((m = hrefPattern.exec(mdxContent)) !== null) {
    links.add(m[1])
  }

  // Filter to known section prefixes only
  const knownPrefixes = SECTIONS.map(s => `/${s}/`)
  return [...links].filter(href =>
    href != null && knownPrefixes.some(prefix => href.startsWith(prefix))
  )
}

/**
 * Normalize href: strip trailing slash, lowercase
 */
function normalizeHref(href: string): string {
  return href.replace(/\/$/, '').toLowerCase()
}

/**
 * Convert section + slug → canonical href
 */
function toHref(section: ContentSection, slug: string): string {
  return `/${section}/${slug}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph builder
// ─────────────────────────────────────────────────────────────────────────────

interface RawPage {
  href:    string
  section: ContentSection
  slug:    string
  title:   string
  tags:    string[]
  outbound: string[]   // normalized hrefs
}

function buildRawGraph(): RawPage[] {
  const pages: RawPage[] = []

  for (const section of SECTIONS) {
    const dir = path.join(CONTENT_ROOT, section)
    if (!fs.existsSync(dir)) continue

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx') || f.endsWith('.md'))

    for (const file of files) {
      const slug = file.replace(/\.mdx?$/, '')
      const raw  = fs.readFileSync(path.join(dir, file), 'utf-8')
      const { data, content } = matter(raw)

      // Skip drafts
      if (data.status === 'draft') continue

      const title = (data.title as string) || slug
      const tags  = (data.tags as string[]) || []

      const rawLinks   = extractInternalLinks(content)
      const normalized = rawLinks.map(normalizeHref)

      pages.push({
        href:     normalizeHref(toHref(section, slug)),
        section,
        slug,
        title,
        tags,
        outbound: [...new Set(normalized)],
      })
    }
  }

  return pages
}

function computeConnectivityScore(inbound: number, outbound: number): number {
  // Score based on being well-linked in both directions
  // Max meaningful: 10 inbound, 10 outbound
  const inScore  = Math.min(inbound  / 10, 1) * 60
  const outScore = Math.min(outbound / 10, 1) * 40
  return Math.round(inScore + outScore)
}

function buildProfiles(pages: RawPage[]): PageLinkProfile[] {
  const hrefSet = new Set(pages.map(p => p.href))

  // Build inbound map
  const inboundMap = new Map<string, string[]>()
  for (const p of pages) {
    if (!inboundMap.has(p.href)) inboundMap.set(p.href, [])
    for (const target of p.outbound) {
      if (!hrefSet.has(target)) continue // link to unknown page — skip
      if (!inboundMap.has(target)) inboundMap.set(target, [])
      inboundMap.get(target)!.push(p.href)
    }
  }

  return pages.map(p => {
    const inbound  = inboundMap.get(p.href) ?? []
    const outbound = p.outbound.filter(href => hrefSet.has(href))
    const ic = inbound.length
    const oc = outbound.length
    const connectivity = computeConnectivityScore(ic, oc)

    return {
      href:              p.href,
      section:           p.section,
      slug:              p.slug,
      title:             p.title,
      tags:              p.tags,
      outbound,
      inbound,
      outboundCount:     oc,
      inboundCount:      ic,
      isOrphaned:        ic === 0,
      isIsolated:        ic < 2 && oc < 2,
      connectivityScore: connectivity,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion engine
// ─────────────────────────────────────────────────────────────────────────────

function computeTagOverlap(a: string[], b: string[]): string[] {
  const setB = new Set(b)
  return a.filter(t => setB.has(t))
}

function generateSuggestions(profiles: PageLinkProfile[]): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = []
  const profileMap = new Map(profiles.map(p => [p.href, p]))

  // Helper: avoid suggesting a link that already exists
  function alreadyLinked(fromHref: string, toHref: string): boolean {
    return profileMap.get(fromHref)?.outbound.includes(toHref) ?? false
  }

  // ── Rule 1: Failure → Playbook bridges ──────────────────────────────────────
  // A failure that has shared tags with a playbook should link to it
  const failures  = profiles.filter(p => p.section === 'failures')
  const playbooks = profiles.filter(p => p.section === 'playbooks')

  for (const failure of failures) {
    for (const playbook of playbooks) {
      if (alreadyLinked(failure.href, playbook.href)) continue
      const shared = computeTagOverlap(failure.tags, playbook.tags)
      if (shared.length > 0) {
        suggestions.push({
          fromHref:   failure.href,
          fromTitle:  failure.title,
          toHref:     playbook.href,
          toTitle:    playbook.title,
          reason:     `Failure report should reference the playbook for recovery procedure`,
          matchType:  'failure-playbook',
          priority:   'high',
          sharedTags: shared,
        })
      }
    }
  }

  // ── Rule 2: Failure → Doc bridges (shared tags) ─────────────────────────────
  const docs = profiles.filter(p => p.section === 'docs')

  for (const failure of failures) {
    for (const doc of docs) {
      if (alreadyLinked(failure.href, doc.href)) continue
      const shared = computeTagOverlap(failure.tags, doc.tags)
      if (shared.length >= 2) {
        suggestions.push({
          fromHref:   failure.href,
          fromTitle:  failure.title,
          toHref:     doc.href,
          toTitle:    doc.title,
          reason:     `Failure should reference related concept doc (${shared.length} shared tags)`,
          matchType:  'section-bridge',
          priority:   shared.length >= 3 ? 'high' : 'medium',
          sharedTags: shared,
        })
      }
    }
  }

  // ── Rule 3: Logs → Doc references ───────────────────────────────────────────
  // Deployment/debug logs that cover topics docs also cover
  const logs = profiles.filter(p => p.section === 'logs')

  for (const log of logs) {
    for (const doc of docs) {
      if (alreadyLinked(log.href, doc.href)) continue
      const shared = computeTagOverlap(log.tags, doc.tags)
      if (shared.length >= 2) {
        suggestions.push({
          fromHref:   log.href,
          fromTitle:  log.title,
          toHref:     doc.href,
          toTitle:    doc.title,
          reason:     `Log covers topics the doc explains in depth`,
          matchType:  'log-doc',
          priority:   'medium',
          sharedTags: shared,
        })
      }
    }
  }

  // ── Rule 4: Case study → Doc references ─────────────────────────────────────
  const caseStudies = profiles.filter(p => p.section === 'case-studies')

  for (const cs of caseStudies) {
    for (const doc of docs) {
      if (alreadyLinked(cs.href, doc.href)) continue
      const shared = computeTagOverlap(cs.tags, doc.tags)
      if (shared.length >= 2) {
        suggestions.push({
          fromHref:   cs.href,
          fromTitle:  cs.title,
          toHref:     doc.href,
          toTitle:    doc.title,
          reason:     `Case study references concepts the doc defines`,
          matchType:  'case-study-doc',
          priority:   'medium',
          sharedTags: shared,
        })
      }
    }
  }

  // ── Rule 5: Orphaned pages — suggest ANY incoming link ──────────────────────
  // For each orphaned page, find the most relevant page that doesn't link to it
  const orphaned = profiles.filter(p => p.isOrphaned)

  for (const orphan of orphaned) {
    // Find best candidate: same section, most tag overlap
    let bestCandidate: PageLinkProfile | null = null
    let bestOverlap = 0

    for (const p of profiles) {
      if (p.href === orphan.href) continue
      if (alreadyLinked(p.href, orphan.href)) continue
      // Prefer same or adjacent section
      const shared = computeTagOverlap(p.tags, orphan.tags)
      if (shared.length > bestOverlap) {
        bestOverlap = shared.length
        bestCandidate = p
      }
    }

    if (bestCandidate && bestOverlap >= 1) {
      suggestions.push({
        fromHref:   bestCandidate.href,
        fromTitle:  bestCandidate.title,
        toHref:     orphan.href,
        toTitle:    orphan.title,
        reason:     `Orphaned page — needs at least one inbound link`,
        matchType:  'section-bridge',
        priority:   'high',
        sharedTags: computeTagOverlap(bestCandidate.tags, orphan.tags),
      })
    }
  }

  // ── Rule 6: Log → Failure references ────────────────────────────────────────
  // A log that covers a failure topic should reference the failure report
  const failureSlugSet = new Set(failures.map(f => f.slug))

  for (const log of logs) {
    for (const failure of failures) {
      if (alreadyLinked(log.href, failure.href)) continue
      const shared = computeTagOverlap(log.tags, failure.tags)
      if (shared.length >= 2) {
        suggestions.push({
          fromHref:   log.href,
          fromTitle:  log.title,
          toHref:     failure.href,
          toTitle:    failure.title,
          reason:     `Log covers an incident — reference the failure report for full detail`,
          matchType:  'log-doc',
          priority:   shared.length >= 3 ? 'high' : 'medium',
          sharedTags: shared,
        })
      }
    }
  }

  // Deduplicate: same from+to pair
  const seen = new Set<string>()
  return suggestions.filter(s => {
    const key = `${s.fromHref}→${s.toHref}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  // Sort: high priority first, then by shared tag count desc
  .sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (pd !== 0) return pd
    return (b.sharedTags?.length ?? 0) - (a.sharedTags?.length ?? 0)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Orphan report
// ─────────────────────────────────────────────────────────────────────────────

function buildOrphanReport(profiles: PageLinkProfile[]): OrphanedPageReport {
  return {
    orphaned: profiles.filter(p => p.isOrphaned),
    isolated: profiles.filter(p => p.isIsolated && !p.isOrphaned),
    hubs:     profiles.filter(p => p.inboundCount >= 5).sort((a, b) => b.inboundCount - a.inboundCount),
    sinks:    profiles.filter(p => p.outboundCount === 0),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(profiles: PageLinkProfile[]): LinkGraphSummary {
  const n = profiles.length
  if (n === 0) return {
    totalPages: 0, totalLinks: 0, orphanedCount: 0,
    isolatedCount: 0, avgInbound: 0, avgOutbound: 0,
    avgConnectivity: 0, hubCount: 0, sinkCount: 0,
  }

  const totalLinks  = profiles.reduce((acc, p) => acc + p.outboundCount, 0)
  const orphaned    = profiles.filter(p => p.isOrphaned)
  const isolated    = profiles.filter(p => p.isIsolated)
  const hubs        = profiles.filter(p => p.inboundCount >= 5)
  const sinks       = profiles.filter(p => p.outboundCount === 0)

  return {
    totalPages:      n,
    totalLinks,
    orphanedCount:   orphaned.length,
    isolatedCount:   isolated.length,
    avgInbound:      Math.round((profiles.reduce((a, p) => a + p.inboundCount, 0)  / n) * 10) / 10,
    avgOutbound:     Math.round((profiles.reduce((a, p) => a + p.outboundCount, 0) / n) * 10) / 10,
    avgConnectivity: Math.round(profiles.reduce((a, p) => a + p.connectivityScore, 0) / n),
    hubCount:        hubs.length,
    sinkCount:       sinks.length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Full link graph report. Memoized per build. */
export function getInternalLinkingReport(): InternalLinkingReport {
  if (_cachedReport) return _cachedReport

  const rawPages   = buildRawGraph()
  const profiles   = buildProfiles(rawPages)
  const suggestions = generateSuggestions(profiles)
  const orphans    = buildOrphanReport(profiles)
  const summary    = buildSummary(profiles)

  _cachedReport = { profiles, suggestions, orphans, summary }
  return _cachedReport
}

/** Page profile for a specific href (e.g. "/failures/edge-runtime-deployment-failure") */
export function getPageProfile(href: string): PageLinkProfile | null {
  const report = getInternalLinkingReport()
  const normalized = normalizeHref(href)
  return report.profiles.find(p => p.href === normalized) ?? null
}

/** Top N link suggestions, optionally filtered by section */
export function getTopLinkSuggestions(
  n = 10,
  filterSection?: ContentSection
): LinkSuggestion[] {
  const report = getInternalLinkingReport()
  let suggestions = report.suggestions
  if (filterSection) {
    suggestions = suggestions.filter(
      s => s.fromHref.startsWith(`/${filterSection}/`) || s.toHref.startsWith(`/${filterSection}/`)
    )
  }
  return suggestions.slice(0, n)
}

/** Orphaned pages — zero inbound links */
export function getOrphanedPages(): PageLinkProfile[] {
  return getInternalLinkingReport().orphans.orphaned
}

/** Isolated pages — fewer than 2 inbound AND 2 outbound */
export function getIsolatedPages(): PageLinkProfile[] {
  return getInternalLinkingReport().orphans.isolated
}

/** Pages sorted by connectivity score ascending (weakest first) */
export function getWeakestPages(n = 20): PageLinkProfile[] {
  const report = getInternalLinkingReport()
  return [...report.profiles]
    .sort((a, b) => a.connectivityScore - b.connectivityScore)
    .slice(0, n)
}

/** Pages sorted by inbound descending (strongest hubs) */
export function getHubPages(n = 10): PageLinkProfile[] {
  const report = getInternalLinkingReport()
  return [...report.profiles]
    .sort((a, b) => b.inboundCount - a.inboundCount)
    .slice(0, n)
}

/** Summary statistics only */
export function getLinkGraphSummary(): LinkGraphSummary {
  return getInternalLinkingReport().summary
}
