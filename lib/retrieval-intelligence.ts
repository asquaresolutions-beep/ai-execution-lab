/**
 * lib/retrieval-intelligence.ts
 *
 * AI Retrieval Quality Intelligence — build-time analysis of the full content
 * corpus for retrieval readiness. Scores every published page on four
 * dimensions critical for AI search citation quality:
 *
 *   1. Answer Structure  — does the content lead with a direct, usable answer?
 *   2. Entity Density    — how many named technical entities per 100 words?
 *   3. Operational Specificity — commands, versions, timings, error messages?
 *   4. Retrieval Chunking — does the content break into logical retrievable units?
 *
 * Builds on top of lib/geo-intelligence.ts (computeEntityDensity, scoreAnswerability).
 * All computation at build time — no external calls.
 */

import fs   from 'fs'
import path from 'path'
import matter from 'gray-matter'
import {
  computeEntityDensity,
  scoreAnswerability,
  PLATFORM_ENTITIES,
  type EntityDensityResult,
  type AnswerabilityResult,
} from './geo-intelligence'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ContentSection = 'docs' | 'failures' | 'logs' | 'case-studies' | 'playbooks' | 'labs' | 'systems'

export type RetrievalGrade = 'A' | 'B' | 'C' | 'D'

export interface RetrievalDimension {
  name:        string
  score:       number        // 0-25 for each dimension (total 0-100)
  label:       string        // 'strong' | 'adequate' | 'weak'
  issue?:      string        // what's missing
  suggestion?: string        // concrete improvement action
}

export interface PageRetrievalProfile {
  section:         ContentSection
  slug:            string
  title:           string
  href:            string
  date:            string
  tags:            string[]
  /** 0-100 composite retrieval score */
  retrievalScore:  number
  grade:           RetrievalGrade
  dimensions:      RetrievalDimension[]
  entityDensity:   EntityDensityResult
  answerability:   AnswerabilityResult
  wordCount:       number
  hasEvidence:     boolean
  evidenceCount:   number
  /** Top entities found in content */
  topEntities:     string[]
  /** Specific gaps that, if fixed, would most improve retrieval score */
  priorityFixes:   string[]
}

export interface RetrievalReport {
  profiles:    PageRetrievalProfile[]
  summary:     RetrievalSummary
  strong:      PageRetrievalProfile[]   // score >= 70
  adequate:    PageRetrievalProfile[]   // score 40-69
  weak:        PageRetrievalProfile[]   // score < 40
  missingAnswerStructure: PageRetrievalProfile[]
  lowEntityDensity:       PageRetrievalProfile[]
  topRetrieval:  PageRetrievalProfile[]  // top 10 by score
  worstFirst:    PageRetrievalProfile[]  // sorted worst-first (action list)
}

export interface RetrievalSummary {
  totalPages:       number
  avgScore:         number
  strongCount:      number
  adequateCount:    number
  weakCount:        number
  gatePassRate:     number   // % with answerability >= 7.0
  avgEntityDensity: number
  avgWordCount:     number
  totalEvidencePieces: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CONTENT_ROOT = path.join(process.cwd(), 'content')

const SECTIONS: ContentSection[] = [
  'docs', 'failures', 'logs', 'case-studies', 'playbooks', 'labs', 'systems'
]

// ─────────────────────────────────────────────────────────────────────────────
// Retrieval scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score answer structure: does the content start with the answer?
 * Checks first 300 chars for definitional or assertive opener.
 */
function scoreAnswerStructure(content: string, frontmatter: Record<string, unknown>): RetrievalDimension {
  const firstPara = content.replace(/^#+\s+.+\n/m, '').slice(0, 400).toLowerCase()

  let score = 0
  let issue: string | undefined
  let suggestion: string | undefined

  // Has a description in frontmatter (contributes to snippet quality)
  const hasDescription = typeof frontmatter.description === 'string' && frontmatter.description.length > 60
  if (hasDescription) score += 5

  // Content opens with a direct definitional or assertive statement
  const opensDirectly = /^(the |this |an? |[a-z].{5,50}(is |are |means |defines |allows |enables ))/.test(firstPara)
  if (opensDirectly) score += 10

  // Has H2/H3 sections (breaks content into retrievable chunks)
  const h2count = (content.match(/^## /gm) ?? []).length
  const h3count = (content.match(/^### /gm) ?? []).length
  if (h2count >= 2) score += 5
  if (h3count >= 3) score += 5

  // Has a clear answer within the first 150 words
  const first150Words = content.split(/\s+/).slice(0, 150).join(' ')
  const hasEarlyAnswer = /[\.\!\?]/.test(first150Words) && first150Words.length > 100
  if (hasEarlyAnswer) score += 0  // baseline, already counted above

  if (score < 10) {
    issue = 'No direct answer structure detected — content may open with context rather than assertion'
    suggestion = 'Lead the first paragraph with the direct answer or core definition in one sentence'
  } else if (score < 18) {
    issue = 'Answer structure is partial — could be more direct in the opening'
    suggestion = 'Move the core answer earlier; ensure description frontmatter is >= 80 chars'
  }

  return {
    name:       'Answer Structure',
    score:      Math.min(score, 25),
    label:      score >= 18 ? 'strong' : score >= 10 ? 'adequate' : 'weak',
    issue,
    suggestion,
  }
}

/**
 * Score entity density: named entities per 100 words.
 */
function scoreEntityDimension(entityResult: EntityDensityResult): RetrievalDimension {
  const density = entityResult.densityPerHundred
  // 0-25 scale: 2.0+ per 100 = 25, 1.0-2.0 = 15-20, 0.6-1.0 = 10-15, < 0.6 = 0-9
  let score = 0
  if (density >= 2.0) score = 25
  else if (density >= 1.5) score = 20
  else if (density >= 1.0) score = 15
  else if (density >= 0.6) score = 10
  else score = Math.round(density * 10)

  return {
    name:       'Entity Density',
    score,
    label:      score >= 18 ? 'strong' : score >= 10 ? 'adequate' : 'weak',
    issue:      score < 10 ? `Low entity density: ${density.toFixed(2)} per 100 words (threshold: 0.6)` : undefined,
    suggestion: score < 10 ? 'Name specific tools, products, version numbers, and platform concepts explicitly' : undefined,
  }
}

/**
 * Score operational specificity: commands, versions, timings, error text.
 */
function scoreOperationalSpecificity(content: string, section: ContentSection): RetrievalDimension {
  const signals: Array<[RegExp, number]> = [
    [/`[^`]{3,80}`/g,                  2],  // inline code
    [/```[\s\S]{20,}/g,                 4],  // code blocks
    [/\d+\.\d+(\.\d+)?/g,              2],  // version numbers
    [/\d+ (minutes?|hours?|seconds?|ms|days?)/gi, 3],  // timing data
    [/(error|Error|ERROR)[\s:].{10,}/g, 3],  // error messages
    [/https?:\/\/[^\s)>"]+/g,           1],  // real URLs
    [/\/(public|evidence|content|app|lib|scripts)\//g, 2],  // file paths
    [/(resolution_time|severity|failure_status):/gi, 2],  // operational fields
  ]

  let rawScore = 0
  for (const [pattern, weight] of signals) {
    const matches = content.match(pattern)
    if (matches && matches.length > 0) rawScore += Math.min(weight * Math.ceil(matches.length / 2), weight * 3)
  }

  // Failures and logs get a different baseline expectation
  const sectionBonus = (section === 'failures' || section === 'logs') ? 3 : 0
  const score = Math.min(rawScore + sectionBonus, 25)

  return {
    name:       'Operational Specificity',
    score,
    label:      score >= 18 ? 'strong' : score >= 10 ? 'adequate' : 'weak',
    issue:      score < 10 ? 'Low operational specificity — content lacks commands, versions, timings, or error text' : undefined,
    suggestion: score < 10 ? 'Add exact commands, version numbers, error messages, or measured timings from production' : undefined,
  }
}

/**
 * Score retrieval chunking: headers, lists, tables — logical breaks.
 */
function scoreRetrievalChunking(content: string, wordCount: number): RetrievalDimension {
  let score = 0

  const h2 = (content.match(/^## .+/gm) ?? []).length
  const h3 = (content.match(/^### .+/gm) ?? []).length
  const tables = (content.match(/^\|.+\|/gm) ?? []).length
  const bullets = (content.match(/^[-*] .+/gm) ?? []).length
  const numberedLists = (content.match(/^\d+\. .+/gm) ?? []).length

  // H2 sections (primary retrieval boundaries)
  if (h2 >= 4)       score += 8
  else if (h2 >= 2)  score += 5
  else if (h2 >= 1)  score += 2

  // H3 subsections
  if (h3 >= 4)       score += 6
  else if (h3 >= 2)  score += 3

  // Tables (highly retrievable structured data)
  if (tables >= 6)   score += 5
  else if (tables >= 3) score += 3

  // Lists (scan-friendly)
  const listItems = bullets + numberedLists
  if (listItems >= 10) score += 6
  else if (listItems >= 5) score += 3

  // Word count sweet spot: 400-2000 words for retrieval
  if (wordCount >= 400 && wordCount <= 2000) score += 0  // already in good range
  else if (wordCount < 200) score -= 5  // too short
  else if (wordCount > 4000) score -= 2  // may dilute chunk quality

  const finalScore = Math.max(0, Math.min(score, 25))

  return {
    name:       'Retrieval Chunking',
    score:      finalScore,
    label:      finalScore >= 18 ? 'strong' : finalScore >= 10 ? 'adequate' : 'weak',
    issue:      finalScore < 10 ? 'Poor chunk structure — few headers, lists, or tables for section-level retrieval' : undefined,
    suggestion: finalScore < 10 ? 'Add H2 sections, bullet lists, or tables to break content into distinct retrievable units' : undefined,
  }
}

/**
 * Compute the composite retrieval score and full profile for one page.
 */
function buildPageProfile(
  section: ContentSection,
  slug: string,
  raw: string
): PageRetrievalProfile {
  const { data: fm, content } = matter(raw)

  const title       = (fm.title as string) || slug
  const date        = (fm.date as string)  || '2026-01-01'
  const tags        = (fm.tags as string[]) || []
  const evidenceImages = (fm.evidence_images as string[]) || []
  const wordCount   = content.split(/\s+/).filter(Boolean).length

  const entityResult    = computeEntityDensity(content)
  const answerability   = scoreAnswerability(content)

  const d1 = scoreAnswerStructure(content, fm)
  const d2 = scoreEntityDimension(entityResult)
  const d3 = scoreOperationalSpecificity(content, section)
  const d4 = scoreRetrievalChunking(content, wordCount)

  const retrievalScore = d1.score + d2.score + d3.score + d4.score

  const grade: RetrievalGrade =
    retrievalScore >= 80 ? 'A' :
    retrievalScore >= 60 ? 'B' :
    retrievalScore >= 40 ? 'C' : 'D'

  // Build priority fix list from weak dimensions
  const priorityFixes: string[] = []
  const dims = [d1, d2, d3, d4]
  for (const d of dims.sort((a, b) => a.score - b.score)) {
    if (d.suggestion && d.score < 15) priorityFixes.push(d.suggestion)
    if (priorityFixes.length >= 2) break
  }
  if (priorityFixes.length === 0 && retrievalScore < 75) {
    priorityFixes.push('Add evidence images (frontmatter evidence_images field)')
  }

  return {
    section,
    slug,
    title,
    href:           `/${section}/${slug}`,
    date,
    tags,
    retrievalScore,
    grade,
    dimensions:     [d1, d2, d3, d4],
    entityDensity:  entityResult,
    answerability,
    wordCount,
    hasEvidence:    evidenceImages.length > 0,
    evidenceCount:  evidenceImages.length,
    topEntities:    entityResult.topEntities.slice(0, 5),
    priorityFixes,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build-time cache
// ─────────────────────────────────────────────────────────────────────────────

let _cachedReport: RetrievalReport | null = null

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function getRetrievalReport(): RetrievalReport {
  if (_cachedReport) return _cachedReport

  const profiles: PageRetrievalProfile[] = []

  for (const section of SECTIONS) {
    const dir = path.join(CONTENT_ROOT, section)
    if (!fs.existsSync(dir)) continue

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx') || f.endsWith('.md'))

    for (const file of files) {
      const slug = file.replace(/\.mdx?$/, '')
      const raw  = fs.readFileSync(path.join(dir, file), 'utf-8')
      const { data: fm } = matter(raw)
      if (fm.status === 'draft') continue

      profiles.push(buildPageProfile(section, slug, raw))
    }
  }

  // Sort by score desc
  profiles.sort((a, b) => b.retrievalScore - a.retrievalScore)

  const n     = profiles.length
  const total = profiles.reduce((s, p) => s + p.retrievalScore, 0)
  const totalEvidence = profiles.reduce((s, p) => s + p.evidenceCount, 0)
  const strong   = profiles.filter(p => p.retrievalScore >= 70)
  const adequate = profiles.filter(p => p.retrievalScore >= 40 && p.retrievalScore < 70)
  const weak     = profiles.filter(p => p.retrievalScore < 40)
  const gatePass = profiles.filter(p => p.answerability.meetsGate)

  const summary: RetrievalSummary = {
    totalPages:          n,
    avgScore:            n > 0 ? Math.round(total / n) : 0,
    strongCount:         strong.length,
    adequateCount:       adequate.length,
    weakCount:           weak.length,
    gatePassRate:        n > 0 ? Math.round((gatePass.length / n) * 100) : 0,
    avgEntityDensity:    n > 0 ? Math.round((profiles.reduce((s, p) => s + p.entityDensity.densityPerHundred, 0) / n) * 100) / 100 : 0,
    avgWordCount:        n > 0 ? Math.round(profiles.reduce((s, p) => s + p.wordCount, 0) / n) : 0,
    totalEvidencePieces: totalEvidence,
  }

  _cachedReport = {
    profiles,
    summary,
    strong,
    adequate,
    weak,
    missingAnswerStructure: profiles.filter(p => p.dimensions[0].label === 'weak'),
    lowEntityDensity:       profiles.filter(p => !p.entityDensity.meetsThreshold),
    topRetrieval:           profiles.slice(0, 10),
    worstFirst:             [...profiles].sort((a, b) => a.retrievalScore - b.retrievalScore).slice(0, 15),
  }

  return _cachedReport
}

export function getTopRetrievalPages(n = 10): PageRetrievalProfile[] {
  return getRetrievalReport().topRetrieval.slice(0, n)
}

export function getWeakRetrievalPages(n = 15): PageRetrievalProfile[] {
  return getRetrievalReport().worstFirst.slice(0, n)
}

export function getRetrievalSummary(): RetrievalSummary {
  return getRetrievalReport().summary
}
