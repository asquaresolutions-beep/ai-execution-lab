// ─────────────────────────────────────────────────────────────────
// lib/intelligence/enrichment.ts
// Semantic metadata enrichment for any document/text: topic classification,
// scam-category detection, authority + trust signals, and SEO/GEO semantic
// tags. Composes EXISTING primitives (scam-intel classify/severity, seo
// authority trustScore) into one structured record so ingestion, ScamCheck,
// TrustSeal, and the GEO layer share a single enrichment contract.
// Deterministic by default (no Vertex cost); upgradeable to AI summaries.
// (tasks 2 + 4)
// ─────────────────────────────────────────────────────────────────

import { ruleClassify } from '@/lib/scam-intel/classify'
import { scoreSeverity } from '@/lib/scam-intel/severity'
import { trustScore, type TrustInput } from '@/lib/seo/authority'
import type { ScamCategory, Severity } from '@/lib/scam-intel/types'

export interface EnrichmentInput {
  title?: string
  text: string
  url?: string
  sourceType?: string
}

export interface ScamSignal {
  isScamRelated: boolean
  category: ScamCategory
  confidence: number
  severity: Severity
  severityScore: number
  tactics: string[]
}

export interface TrustSignal {
  score: number                  // 0..100
  band: 'standard' | 'verified' | 'authoritative'
  hasOfficialRefs: boolean
  hasHelpline: boolean
  hasCitations: boolean
  hasFreshness: boolean
  bilingual: boolean
}

export interface SemanticTags {
  topics: string[]               // coarse topic classification
  geoTags: string[]              // GEO/AI-search intent tags
  entities: string[]             // detected named entities (orgs/products)
  contentType: 'guide' | 'analysis' | 'tool' | 'news' | 'reference' | 'page'
}

export interface Enrichment {
  scam: ScamSignal
  trust: TrustSignal
  tags: SemanticTags
  readingTimeMin: number
  lang: 'en' | 'hi' | 'mixed'
}

// Coarse topic lexicon (extensible; keep cheap + explainable).
const TOPIC_LEXICON: Record<string, RegExp> = {
  seo: /\b(seo|search engine|serp|backlink|keyword|ranking|crawl|index)\b/i,
  geo: /\b(geo|generative engine|ai overview|chatgpt search|llm|answer engine|ai search)\b/i,
  scam_safety: /\b(scam|fraud|phishing|otp|upi|cyber\s?crime|helpline|1930)\b/i,
  fact_check: /\b(fact[\s-]?check|misinformation|verify|claim|source|citation|trust)\b/i,
  ai_automation: /\b(automation|workflow|agent|pipeline|llm|inference|model)\b/i,
  cloud: /\b(cloud|serverless|vertex|bigquery|cloud run|gcp|infrastructure)\b/i,
  marketing: /\b(marketing|conversion|roi|campaign|funnel|brand|audience)\b/i,
}

const GEO_INTENT: Record<string, RegExp> = {
  'how-to': /\bhow to\b|\bsteps?\b|\bguide\b/i,
  comparison: /\bvs\b|\bversus\b|\bcompare|\bbest\b|\balternative/i,
  definition: /\bwhat is\b|\bdefinition\b|\bmeaning\b/i,
  local: /\bindia\b|\buk\b|\bcity\b|\bnear me\b/i,
  faq: /\bfaq\b|\bquestions?\b|\?(?:\s|$)/i,
}

function detectLang(text: string): 'en' | 'hi' | 'mixed' {
  const hi = /[ऀ-ॿ]/.test(text)
  const en = /[a-z]{4,}/i.test(text)
  return hi && en ? 'mixed' : hi ? 'hi' : 'en'
}

function detectEntities(text: string): string[] {
  const out = new Set<string>()
  const known = ['ScamCheck', 'TrustSeal', 'A Square Solutions', 'Google', 'WhatsApp', 'UPI', 'RBI', 'NPCI', 'Vertex AI', 'BigQuery', 'ChatGPT']
  for (const k of known) if (new RegExp(`\\b${k.replace(/\s/g, '\\s')}\\b`, 'i').test(text)) out.add(k)
  // CamelCase / capitalised multiword orgs (lightweight).
  for (const m of text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/g) ?? []) if (m.length > 5) out.add(m)
  return Array.from(out).slice(0, 12)
}

function classifyContentType(input: EnrichmentInput): SemanticTags['contentType'] {
  const t = `${input.title ?? ''} ${input.text}`.toLowerCase()
  if (input.sourceType === 'scamcheck' || input.sourceType === 'trustseal') return 'tool'
  if (/\bhow to\b|\bguide\b|\bsteps\b/.test(t)) return 'guide'
  if (/\banalysis\b|\bdata\b|\breport\b|\bstudy\b/.test(t)) return 'analysis'
  if (/\bnews\b|\bupdate\b|\b202\d\b/.test(t)) return 'news'
  if (input.sourceType === 'service_page' || input.sourceType === 'page') return 'page'
  return 'reference'
}

function semanticTags(input: EnrichmentInput): SemanticTags {
  const hay = `${input.title ?? ''} ${input.text}`
  const topics = Object.entries(TOPIC_LEXICON).filter(([, re]) => re.test(hay)).map(([k]) => k)
  const geoTags = Object.entries(GEO_INTENT).filter(([, re]) => re.test(hay)).map(([k]) => k)
  return { topics: topics.length ? topics : ['general'], geoTags, entities: detectEntities(hay), contentType: classifyContentType(input) }
}

function trustSignal(input: EnrichmentInput): TrustSignal {
  const t = input.text
  const hasOfficialRefs = /\b(rbi|npci|cert-in|cybercrime\.gov\.in|gov\.in|1930)\b/i.test(t)
  const hasHelpline = /\b1930\b|\bhelpline\b|\breport (it|this|to)\b/i.test(t)
  const citationCount = (t.match(/https?:\/\/[^\s)]+/g) ?? []).length
  const hasFreshness = /\b(updated|last reviewed|202\d)\b/i.test(t)
  const factCount = (t.match(/\b\d+%|\b\d{4}\b|\bcrore|\blakh\b/gi) ?? []).length
  const bilingual = detectLang(t) !== 'en'
  const ti: TrustInput = { hasOfficialRefs, citationCount, hasHelpline, hasLastUpdated: hasFreshness, factCount, bilingual }
  const ts = trustScore(ti)
  return { score: ts.score, band: ts.band, hasOfficialRefs, hasHelpline, hasCitations: citationCount > 0, hasFreshness, bilingual }
}

function scamSignal(input: EnrichmentInput): ScamSignal {
  const c = ruleClassify(input.text)
  const isScamRelated = c.category !== 'other' || /\b(scam|fraud|phishing|otp|upi)\b/i.test(input.text)
  const sev = scoreSeverity(c)
  return { isScamRelated, category: c.category, confidence: c.confidence, severity: sev.severity, severityScore: sev.score, tactics: c.tactics }
}

/** Full enrichment for a document/text. Pure + deterministic. */
export function enrich(input: EnrichmentInput): Enrichment {
  const words = input.text.split(/\s+/).filter(Boolean).length
  return {
    scam: scamSignal(input),
    trust: trustSignal(input),
    tags: semanticTags(input),
    readingTimeMin: Math.max(1, Math.round(words / 220)),
    lang: detectLang(input.text),
  }
}
