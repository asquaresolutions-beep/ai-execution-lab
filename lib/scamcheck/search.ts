// ─────────────────────────────────────────────────────────────────
// lib/scamcheck/search.ts
// Deterministic search over the public scam knowledge base (intelligence pages
// + checker pages). Always-on, zero Vertex cost — powers the searchable scam
// database. Optionally augmentable with live VECTOR_SEARCH later.
// ─────────────────────────────────────────────────────────────────

import { INTEL_PAGES } from '@/lib/scam-intel/intel-pages'
import { CHECKERS } from '@/lib/scamcheck/checkers'

export interface ScamSearchHit {
  kind: 'intelligence' | 'checker'
  slug: string
  href: string
  title: string
  snippet: string
  category?: string
  score: number
}

const STOP = new Set(['the', 'a', 'an', 'is', 'to', 'of', 'for', 'how', 'what', 'do', 'i', 'my', 'in', 'on', 'and', 'or'])
function terms(q: string): string[] {
  return Array.from(new Set((q.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t))))
}

type Indexed = ScamSearchHit & { hay: string }
export function searchScams(q: string, limit = 20): ScamSearchHit[] {
  const ts = terms(q)
  const docs: Indexed[] = [
    ...INTEL_PAGES.map((p) => ({ kind: 'intelligence' as const, slug: p.slug, href: `/scam-intelligence/${p.slug}`, title: p.h1, snippet: p.directAnswer.slice(0, 160), category: p.category, hay: `${p.h1} ${p.directAnswer} ${p.category} ${p.brands.join(' ')} ${p.redFlags.join(' ')}`.toLowerCase(), score: 0 })),
    ...CHECKERS.map((c) => ({ kind: 'checker' as const, slug: c.slug, href: `/${c.slug}`, title: c.h1, snippet: c.description.slice(0, 160), category: c.tab, hay: `${c.h1} ${c.description} ${c.intro} ${c.tab}`.toLowerCase(), score: 0 })),
  ]
  if (!ts.length) return docs.slice(0, limit).map(({ hay: _hay, ...d }) => d)
  const scored = docs.map((d) => {
    let score = 0
    for (const t of ts) { if (d.hay.includes(t)) score += d.title.toLowerCase().includes(t) ? 3 : 1 }
    return { ...d, score }
  }).filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, limit)
  return scored.map(({ hay: _hay, ...d }) => d)
}
