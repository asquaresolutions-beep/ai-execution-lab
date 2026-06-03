// ─────────────────────────────────────────────────────────────────
// lib/intelligence/geo.ts
// GEO / AI-search optimization scoring: how ready a piece of content is to be
// cited by AI Overviews / ChatGPT-search / answer engines. Deterministic,
// explainable heuristics (no Vertex cost) with an answer-first suggestion
// engine. Monetizable as a "GEO readiness" audit API. (task 5)
// ─────────────────────────────────────────────────────────────────

export interface GeoInput { title?: string; text: string; url?: string }

export interface GeoScore {
  aiOverviewReadiness: number    // 0..100 — structural fitness for extraction
  citationProbability: number    // 0..100 — likelihood an answer engine cites it
  semanticAuthority: number      // 0..100 — trust/expertise signals
  overall: number                // 0..100 weighted
  factors: Record<string, number>
  suggestions: string[]          // answer-first, prioritised
}

function has(re: RegExp, t: string): boolean { return re.test(t) }

/** Score content for AI-search citability and return answer-first suggestions. */
export function geoScore(input: GeoInput): GeoScore {
  const title = input.title ?? ''
  const text = input.text ?? ''
  const words = text.split(/\s+/).filter(Boolean).length
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  const avgSentenceWords = words / Math.max(1, sentences.length)

  // ── AI Overview readiness: structure that LLMs extract cleanly ──
  const hasQuestionHeading = has(/^#{1,6}\s.*\?|(?:^|\n)\s*(what|how|why|when|where|is|can|does)\b.*\?/im, text)
  const hasLists = has(/(?:^|\n)\s*([-*]|\d+\.)\s+/m, text)
  const hasHeadings = (text.match(/(?:^|\n)#{1,6}\s+/g) ?? []).length
  const hasDirectAnswer = has(/\b(in short|the answer is|simply put|tl;dr|to summari[sz]e)\b/i, text) || avgSentenceWords < 24
  const conciseSentences = avgSentenceWords <= 22
  const readinessFactors = {
    questionHeading: hasQuestionHeading ? 22 : 0,
    headings: Math.min(20, hasHeadings * 5),
    lists: hasLists ? 18 : 0,
    directAnswer: hasDirectAnswer ? 22 : 0,
    concise: conciseSentences ? 18 : 6,
  }
  const aiOverviewReadiness = Math.min(100, sum(readinessFactors))

  // ── Citation probability: factual density + sources + specificity ──
  const stats = (text.match(/\b\d+(\.\d+)?%|\b\d{4}\b|\bcrore|\blakh\b|₹|\$\d/gi) ?? []).length
  const links = (text.match(/https?:\/\/[^\s)]+/g) ?? []).length
  const officialRefs = has(/\b(rbi|npci|cert-in|gov\.in|cybercrime|1930|who\.int|google\b)\b/i, text)
  const citationFactors = {
    statistics: Math.min(30, stats * 4),
    sources: Math.min(25, links * 6),
    officialRefs: officialRefs ? 25 : 0,
    depth: Math.min(20, Math.floor(words / 200) * 4),
  }
  const citationProbability = Math.min(100, sum(citationFactors))

  // ── Semantic authority: expertise + freshness + entity clarity ──
  const freshness = has(/\b(updated|last reviewed|202\d)\b/i, text)
  const author = has(/\b(by|author|written by|reviewed by)\b/i, text)
  const entitiesClear = has(/\b(ScamCheck|TrustSeal|A Square Solutions)\b/i, `${title} ${text}`)
  const authorityFactors = {
    freshness: freshness ? 30 : 0,
    authorship: author ? 25 : 0,
    entityClarity: entitiesClear ? 20 : 0,
    titleQuestion: /\?/.test(title) || /\b(how|what|why|guide|best)\b/i.test(title) ? 25 : 8,
  }
  const semanticAuthority = Math.min(100, sum(authorityFactors))

  const overall = Math.round(0.4 * aiOverviewReadiness + 0.35 * citationProbability + 0.25 * semanticAuthority)

  // ── Answer-first suggestions (prioritised by largest gap) ──
  const suggestions: Array<{ gain: number; tip: string }> = []
  if (!hasDirectAnswer) suggestions.push({ gain: 22, tip: 'Open with a 1–2 sentence direct answer (answer-first), before context — this is the snippet AI Overviews lift.' })
  if (!hasQuestionHeading) suggestions.push({ gain: 22, tip: 'Add question-form H2/H3 headings (“How does…?”, “What is…?”) matching real queries.' })
  if (!hasLists) suggestions.push({ gain: 18, tip: 'Convert key steps/criteria into bullet or numbered lists — LLMs extract structured lists readily.' })
  if (stats < 3) suggestions.push({ gain: 16, tip: 'Add concrete statistics, dates, and figures (with sources) — factual density drives citations.' })
  if (links < 2 && !officialRefs) suggestions.push({ gain: 16, tip: 'Cite authoritative sources (RBI/NPCI/CERT-In/official portals) to raise citation probability.' })
  if (!freshness) suggestions.push({ gain: 12, tip: 'Show a visible “Last updated” date — freshness is a strong AI-citation signal.' })
  if (!conciseSentences) suggestions.push({ gain: 10, tip: `Shorten sentences (avg ${Math.round(avgSentenceWords)} words) to under ~22 for cleaner extraction.` })
  suggestions.sort((a, b) => b.gain - a.gain)

  return {
    aiOverviewReadiness,
    citationProbability,
    semanticAuthority,
    overall,
    factors: { ...prefix('readiness', readinessFactors), ...prefix('citation', citationFactors), ...prefix('authority', authorityFactors) },
    suggestions: suggestions.map((s) => s.tip),
  }
}

function sum(o: Record<string, number>): number { return Object.values(o).reduce((a, b) => a + b, 0) }
function prefix(p: string, o: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [`${p}_${k}`, v]))
}
