// ─────────────────────────────────────────────────────────────────
// lib/distribution/linking.ts
// Auto internal-linking + related-page suggestions.
//
// Strategy (deterministic, no AI cost): match the new alert against the
// catalogue of existing published alerts by shared platform/region/tags
// using embedding similarity when available, falling back to keyword
// overlap. The catalogue is read from the store (collection `alerts`).
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'
import { embed, cosineSimilarity } from '@/lib/ai/embeddings'
import type { InternalLink, ScamInput } from './types'

interface AlertIndexDoc {
  id: string
  title: string
  slug: string
  platform: string
  region: string
  keywords: string[]
  vector?: number[]
}

const COLLECTION = 'alerts'

/** Static evergreen targets every alert should consider linking to. */
const EVERGREEN: InternalLink[] = [
  { anchor: 'How to report a scam', path: '/how-to-report', reason: 'evergreen reporting guide' },
  { anchor: 'Protect yourself online', path: '/protect-yourself', reason: 'evergreen safety guide' },
  { anchor: 'Types of scams', path: '/types-of-scams', reason: 'topic hub' },
]

export async function buildInternalLinks(
  input: ScamInput,
  keywords: string[],
): Promise<{ internalLinks: InternalLink[]; relatedPages: InternalLink[] }> {
  const store = getStore()
  const existing = await store.query<AlertIndexDoc>(COLLECTION, { limit: 500 })

  const queryText = `${input.title} ${input.platform} ${input.region} ${keywords.join(' ')}`
  const { vector } = await embed(queryText)

  const scored = existing
    .map((d) => {
      const doc = d.data
      let score = doc.vector?.length ? cosineSimilarity(vector, doc.vector) : 0
      // Keyword / facet overlap boosts (works even without embeddings).
      if (doc.platform?.toLowerCase() === input.platform.toLowerCase()) score += 0.15
      if (doc.region?.toLowerCase() === input.region.toLowerCase()) score += 0.1
      score += overlap(keywords, doc.keywords || []) * 0.2
      return { doc, score }
    })
    .filter((x) => x.score > 0.12)
    .sort((a, b) => b.score - a.score)

  const relatedPages: InternalLink[] = scored.slice(0, 6).map(({ doc, score }) => ({
    anchor: doc.title,
    path: `/alerts/${doc.slug}`,
    reason: `similarity ${score.toFixed(2)} (${doc.platform}/${doc.region})`,
  }))

  // Internal links = top related + evergreen, de-duplicated by path.
  const internalLinks = dedupeByPath([...relatedPages.slice(0, 3), ...EVERGREEN])
  return { internalLinks, relatedPages }
}

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const setB = new Set(b.map((x) => x.toLowerCase()))
  const hits = a.filter((x) => setB.has(x.toLowerCase())).length
  return hits / Math.max(a.length, b.length)
}

function dedupeByPath(links: InternalLink[]): InternalLink[] {
  const seen = new Set<string>()
  return links.filter((l) => (seen.has(l.path) ? false : (seen.add(l.path), true)))
}
