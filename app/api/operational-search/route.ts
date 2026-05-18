/**
 * app/api/operational-search/route.ts
 * Operational search endpoint — returns debugging context, not documents.
 *
 * Query routing (in priority order):
 *   1. Exact entity slug match → full debug context or impact chain
 *   2. Tag overlap → entities with matching tags, ranked by overlap count
 *   3. Keyword match in entity title → scored by keyword density
 *   4. Pattern keyword match → failures that exemplify matching patterns
 *
 * Response format: OperationalSearchResult (structured, MCP-compatible)
 *
 * GET /api/operational-search?q=<query>&type=<entityType>&limit=<n>
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  ENTITIES,
  RELATIONSHIPS,
  getDebugContext,
  getLessonImpactChain,
  getEntityById,
  type EntityType,
  type OperationalEntity,
} from '@/lib/operational-memory'
import { getConfidenceScore, getFailureMemory } from '@/lib/failure-memory'
import { getPathwayById, getPathwaysForSlug, EXECUTION_PATHWAYS } from '@/lib/execution-pathways'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface SearchMatch {
  entity:          OperationalEntity
  matchType:       'exact' | 'tag' | 'keyword' | 'pattern'
  relevanceScore:  number   // 0–100
  confidenceScore?: number  // for failures only
}

interface DebugPackage {
  type:              'debug-context'
  failure:           OperationalEntity
  confidenceScore:   number
  patterns:          OperationalEntity[]
  preventionLessons: OperationalEntity[]
  resolverPlaybooks: OperationalEntity[]
  relatedFailures:   OperationalEntity[]
  caseStudies:       OperationalEntity[]
}

interface LessonPackage {
  type:              'lesson-impact'
  lesson:            OperationalEntity
  preventsFailures:  OperationalEntity[]
  caseStudies:       OperationalEntity[]
}

interface PathwayPackage {
  type:    'pathways'
  slugRef: string
  pathways: Array<{
    id: string; title: string; description: string
    estimatedTime: string; stepCount: number
  }>
}

export interface OperationalSearchResult {
  query:       string
  totalMatches: number
  matches:     SearchMatch[]
  /** Rich context package for the top result */
  topContext?: DebugPackage | LessonPackage | PathwayPackage
  relatedPathways?: Array<{ id: string; title: string; estimatedTime: string }>
}

// ─────────────────────────────────────────────────────────────
// Routing helpers
// ─────────────────────────────────────────────────────────────

/** Exact slug match: query matches entity slug directly */
function exactMatch(q: string, typeFilter?: EntityType): SearchMatch | null {
  const normalised = q.toLowerCase().replace(/\s+/g, '-')
  for (const type of (typeFilter ? [typeFilter] : ['failure', 'lesson', 'playbook', 'case-study', 'doc', 'pattern'] as EntityType[])) {
    const id = `${type}:${normalised}`
    const entity = getEntityById(id)
    if (entity) {
      const conf = entity.type === 'failure' ? getConfidenceScore(normalised) : undefined
      return { entity, matchType: 'exact', relevanceScore: 100, confidenceScore: conf ?? undefined }
    }
  }
  return null
}

/** Tag overlap match: count how many entity tags appear in the query tokens */
function tagMatches(tokens: string[], typeFilter?: EntityType): SearchMatch[] {
  const results: SearchMatch[] = []
  for (const entity of ENTITIES) {
    if (typeFilter && entity.type !== typeFilter) continue
    if (!entity.tags || entity.tags.length === 0) continue
    const overlap = entity.tags.filter(t => tokens.includes(t.toLowerCase())).length
    if (overlap > 0) {
      const score = Math.min(60 + overlap * 10, 85)
      const conf  = entity.type === 'failure' ? getConfidenceScore(entity.id.split(':')[1]) : undefined
      results.push({ entity, matchType: 'tag', relevanceScore: score, confidenceScore: conf ?? undefined })
    }
  }
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/** Keyword match: query words appear in entity title */
function keywordMatches(tokens: string[], typeFilter?: EntityType): SearchMatch[] {
  const results: SearchMatch[] = []
  for (const entity of ENTITIES) {
    if (typeFilter && entity.type !== typeFilter) continue
    const titleWords = entity.title.toLowerCase().split(/\s+/)
    const matched    = tokens.filter(t => titleWords.some(w => w.includes(t))).length
    if (matched > 0) {
      const score = Math.min(50 + matched * 8, 75)
      const conf  = entity.type === 'failure' ? getConfidenceScore(entity.id.split(':')[1]) : undefined
      results.push({ entity, matchType: 'keyword', relevanceScore: score, confidenceScore: conf ?? undefined })
    }
  }
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/** Pattern keyword match: query mentions pattern-related symptoms */
const PATTERN_KEYWORDS: Record<string, string[]> = {
  'pattern:module-boundary-violations':       ['edge', 'runtime', 'client', 'bundle', 'fs', 'module', 'crypto'],
  'pattern:dependency-default-changes':       ['blockjs', 'upgrade', 'silent', 'default', 'breaking', 'changelog'],
  'pattern:runtime-environment-scope-drift':  ['env', 'environment', 'production', 'undefined', 'scope', 'vercel'],
  'pattern:infrastructure-timing-dependencies': ['dns', 'propagation', 'cert', 'ssl', 'timing', 'subdomain'],
  'pattern:authentication-encoding-pitfalls': ['auth', 'base64', 'password', 'encoding', 'header', 'cookie', 'ga4'],
}

function patternMatches(tokens: string[]): SearchMatch[] {
  const results: SearchMatch[] = []
  for (const [patternId, keywords] of Object.entries(PATTERN_KEYWORDS)) {
    const overlap = keywords.filter(k => tokens.some(t => t.includes(k))).length
    if (overlap >= 2) {
      const entity = getEntityById(patternId)
      if (entity) {
        results.push({ entity, matchType: 'pattern', relevanceScore: 60 + overlap * 5 })
      }
    }
  }
  return results
}

/** Deduplicate matches by entity ID, keeping highest relevance score */
function dedupeMatches(matches: SearchMatch[]): SearchMatch[] {
  const seen = new Map<string, SearchMatch>()
  for (const m of matches) {
    const existing = seen.get(m.entity.id)
    if (!existing || m.relevanceScore > existing.relevanceScore) {
      seen.set(m.entity.id, m)
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/** Build rich context package for top result */
function buildTopContext(
  match: SearchMatch
): DebugPackage | LessonPackage | PathwayPackage | undefined {
  const { entity } = match

  if (entity.type === 'failure') {
    const slug  = entity.id.replace('failure:', '')
    const ctx   = getDebugContext(entity.id)
    const conf  = getConfidenceScore(slug)

    // Related failures: other failures in same patterns
    const relatedFailures: OperationalEntity[] = []
    const seen = new Set<string>([entity.id])
    for (const pat of ctx.relatedPatterns) {
      for (const rel of RELATIONSHIPS.filter(r => r.to === pat.id && r.type === 'exemplifies')) {
        if (!seen.has(rel.from)) {
          seen.add(rel.from)
          const e = getEntityById(rel.from)
          if (e && e.type === 'failure') relatedFailures.push(e)
        }
      }
    }

    return {
      type:              'debug-context',
      failure:           entity,
      confidenceScore:   conf,
      patterns:          ctx.relatedPatterns,
      preventionLessons: ctx.preventionLessons,
      resolverPlaybooks: ctx.resolverPlaybooks,
      relatedFailures,
      caseStudies:       ctx.demonstratingCases,
    }
  }

  if (entity.type === 'lesson') {
    const chain = getLessonImpactChain(entity.id)
    return {
      type:             'lesson-impact',
      lesson:           entity,
      preventsFailures: chain.preventsFailures,
      caseStudies:      chain.demonstratingCases,
    }
  }

  return undefined
}

// ─────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q          = (searchParams.get('q') ?? '').trim()
  const typeParam  = searchParams.get('type') as EntityType | null
  const limitParam = parseInt(searchParams.get('limit') ?? '10', 10)
  const limit      = Math.min(Math.max(limitParam, 1), 50)

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: 'Query parameter `q` must be at least 2 characters.' },
      { status: 400 }
    )
  }

  const tokens  = q.toLowerCase().split(/[\s\-_]+/).filter(t => t.length >= 2)
  const allMatches: SearchMatch[] = []

  // 1. Exact slug match
  const exact = exactMatch(q, typeParam ?? undefined)
  if (exact) allMatches.push(exact)

  // 2. Tag overlap
  allMatches.push(...tagMatches(tokens, typeParam ?? undefined))

  // 3. Keyword match
  allMatches.push(...keywordMatches(tokens, typeParam ?? undefined))

  // 4. Pattern match (no type filter — patterns are always included)
  allMatches.push(...patternMatches(tokens))

  const deduped  = dedupeMatches(allMatches).slice(0, limit)
  const topMatch = deduped[0]
  const topContext = topMatch ? buildTopContext(topMatch) : undefined

  // Related pathways for top result
  const relatedPathways = topMatch
    ? getPathwaysForSlug(topMatch.entity.id.split(':')[1] ?? '')
        .map(p => ({ id: p.id, title: p.title, estimatedTime: p.estimatedTime }))
        .slice(0, 3)
    : []

  const result: OperationalSearchResult = {
    query:          q,
    totalMatches:   deduped.length,
    matches:        deduped,
    topContext,
    relatedPathways: relatedPathways.length > 0 ? relatedPathways : undefined,
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
