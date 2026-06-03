// ─────────────────────────────────────────────────────────────────
// lib/intelligence/chunking.ts
// Intelligent, context-preserving article chunking for embeddings + RAG.
//
// Long articles embedded as a single 768-dim vector lose local detail. We
// split on semantic boundaries (headings → paragraphs → sentences) into
// token-bounded chunks with overlap, so each chunk is independently
// retrievable while preserving surrounding context. Pure + deterministic
// (no Vertex calls); the embeddings pipeline embeds each returned chunk.
// ─────────────────────────────────────────────────────────────────

export interface Chunk {
  index: number
  text: string
  heading: string      // nearest preceding heading (section context)
  charStart: number
  tokensEst: number
}

export interface ChunkOptions {
  maxTokens?: number   // target chunk size (≈ words * 1.3)
  overlapTokens?: number
  minTokens?: number   // merge trailing tiny chunks up to this
}

// Rough token estimate without a tokenizer dependency (~1.3 tokens/word).
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.ceil(words * 1.3)
}

/**
 * Split markdown/plain article text into semantic chunks.
 * Strategy: segment by markdown headings to keep section context, then pack
 * paragraphs into chunks up to maxTokens with a sentence-aligned overlap.
 */
export function chunkArticle(raw: string, opts: ChunkOptions = {}): Chunk[] {
  const maxTokens = opts.maxTokens ?? 380
  const overlapTokens = opts.overlapTokens ?? 60
  const minTokens = opts.minTokens ?? 40
  const text = (raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return []

  // 1. Split into (heading, body) sections on markdown headings.
  const sections: Array<{ heading: string; body: string; offset: number }> = []
  const headingRe = /^(#{1,6})\s+(.+)$/gm
  let lastIndex = 0
  let lastHeading = ''
  let m: RegExpExecArray | null
  const pushSection = (heading: string, start: number, end: number) => {
    const body = text.slice(start, end).trim()
    if (body) sections.push({ heading, body, offset: start })
  }
  while ((m = headingRe.exec(text))) {
    pushSection(lastHeading, lastIndex, m.index)
    lastHeading = m[2].trim()
    lastIndex = headingRe.lastIndex
  }
  pushSection(lastHeading, lastIndex, text.length)
  if (!sections.length) sections.push({ heading: '', body: text, offset: 0 })

  // 2. Pack paragraphs within each section into token-bounded chunks.
  const chunks: Chunk[] = []
  let index = 0
  for (const sec of sections) {
    const paras = sec.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    let buf: string[] = []
    let bufTokens = 0
    let bufStart = sec.offset
    const flush = () => {
      if (!buf.length) return
      const body = buf.join('\n\n')
      const prefixed = sec.heading ? `${sec.heading}\n\n${body}` : body
      chunks.push({ index: index++, text: prefixed, heading: sec.heading, charStart: bufStart, tokensEst: estimateTokens(prefixed) })
      // Sentence-aligned overlap carried into the next chunk.
      if (overlapTokens > 0) {
        const sentences = body.split(/(?<=[.!?])\s+/)
        const carry: string[] = []
        let carryTokens = 0
        for (let i = sentences.length - 1; i >= 0 && carryTokens < overlapTokens; i--) {
          carry.unshift(sentences[i]); carryTokens += estimateTokens(sentences[i])
        }
        buf = carry.length ? [carry.join(' ')] : []
        bufTokens = carryTokens
      } else { buf = []; bufTokens = 0 }
    }
    for (const para of paras) {
      const t = estimateTokens(para)
      if (bufTokens + t > maxTokens && bufTokens > 0) flush()
      if (!buf.length) bufStart = sec.offset
      buf.push(para); bufTokens += t
    }
    flush()
  }

  // 3. Merge trailing tiny chunks into the previous one.
  const merged: Chunk[] = []
  for (const c of chunks) {
    const prev = merged[merged.length - 1]
    if (prev && c.tokensEst < minTokens && prev.heading === c.heading) {
      prev.text += `\n\n${c.text}`; prev.tokensEst += c.tokensEst
    } else merged.push({ ...c, index: merged.length })
  }
  return merged
}

/** Build a stable chunk id from a parent doc id + chunk index. */
export function chunkId(docId: string, index: number): string {
  return `${docId}__c${index}`
}
