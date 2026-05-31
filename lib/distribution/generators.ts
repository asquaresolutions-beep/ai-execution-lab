// ─────────────────────────────────────────────────────────────────
// lib/distribution/generators.ts
// One generator per output type. Each is independently callable, cached,
// rate-limited, and audited — the engine composes them, but they can be
// re-run individually from the dashboard (e.g. "regenerate social only").
// ─────────────────────────────────────────────────────────────────

import { getProvider, generateJSON } from '@/lib/ai/provider'
import type { ModelTier } from '@/lib/ai/usage'
import { cached } from '@/lib/ai/cache'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/ai/rate-limit'
import { audit } from '@/lib/ai/audit'
import {
  articlePrompt, seoPrompt, geoPrompt, socialPrompt, reelPrompt, faqPrompt,
  PROMPT_VERSION,
} from './prompts'
import type {
  ScamInput, Locale, SeoMetadata, GeoSummary, SocialCopy, ReelScript, FaqItem,
} from './types'

interface GenCtx { input: ScamInput; locale: Locale }

// Deep analysis (article) → Pro by default; set DEEP_TIER=flash to cut
// article cost ~4x for low-cost autonomous operation. Fast structured
// jobs (seo/geo/social/reel/faq) always use Flash.
const DEEP_TIER: ModelTier = process.env.DEEP_TIER === 'flash' ? 'flash' : 'pro'

async function withGuards(op: string) {
  await enforceRateLimit({ key: 'ai:generate', ...RATE_LIMITS.aiGenerate })
  await enforceRateLimit({ key: 'ai:generate:daily', ...RATE_LIMITS.aiGenerateDaily })
  await audit({ action: 'ai.generate', actor: 'system', ok: true, message: op, meta: { promptVersion: PROMPT_VERSION } })
}

// ── 1. Article ─────────────────────────────────────────────────────
export async function genArticle({ input, locale }: GenCtx): Promise<string> {
  return cached('article', { input, locale, v: PROMPT_VERSION }, async () => {
    await withGuards('article')
    const p = articlePrompt(input, locale)
    return getProvider().generate(p.user, { system: p.system, temperature: 0.6, maxTokens: 2200, tier: DEEP_TIER })
  })
}

// ── 2. SEO metadata ────────────────────────────────────────────────
export async function genSeo({ input, locale }: GenCtx): Promise<SeoMetadata> {
  return cached('seo', { input, locale, v: PROMPT_VERSION }, async () => {
    await withGuards('seo')
    const p = seoPrompt(input, locale)
    const raw = await generateJSON<Partial<SeoMetadata>>(p.user, { system: p.system, temperature: 0.4 })
    const slug = (raw.slug || slugify(input.title)).trim()
    return {
      metaTitle: clamp(raw.metaTitle || input.title, 60),
      metaDescription: clamp(raw.metaDescription || input.description, 155),
      slug,
      canonicalPath: `/alerts/${slug}`,
      ogTitle: raw.ogTitle || raw.metaTitle || input.title,
      ogDescription: clamp(raw.ogDescription || raw.metaDescription || input.description, 110),
      keywords: dedupe(raw.keywords || []),
    }
  })
}

// ── 3. GEO summary ─────────────────────────────────────────────────
export async function genGeo({ input, locale }: GenCtx): Promise<GeoSummary> {
  return cached('geo', { input, locale, v: PROMPT_VERSION }, async () => {
    await withGuards('geo')
    const p = geoPrompt(input, locale)
    const raw = await generateJSON<Partial<GeoSummary>>(p.user, { system: p.system, temperature: 0.4 })
    return {
      answer: raw.answer || `${input.title}: ${input.description}`,
      keyFacts: raw.keyFacts || [],
      entities: dedupe([...(raw.entities || []), input.platform, input.region]),
    }
  })
}

// ── 4. Social copy ─────────────────────────────────────────────────
export async function genSocial({ input, locale }: GenCtx): Promise<SocialCopy> {
  return cached('social', { input, locale, v: PROMPT_VERSION }, async () => {
    await withGuards('social')
    const p = socialPrompt(input, locale)
    const raw = await generateJSON<Partial<SocialCopy>>(p.user, { system: p.system, temperature: 0.8 })
    return {
      linkedin: raw.linkedin || '',
      twitter: clamp(raw.twitter || '', 280),
      twitterThread: raw.twitterThread || [],
      facebook: raw.facebook || '',
      threads: clamp(raw.threads || '', 480),
      reddit: raw.reddit || { title: input.title, body: input.description, subreddits: ['Scams'] },
    }
  })
}

// ── 5. Reel / Shorts script ────────────────────────────────────────
export async function genReel({ input, locale }: GenCtx): Promise<ReelScript> {
  return cached('reel', { input, locale, v: PROMPT_VERSION }, async () => {
    await withGuards('reel')
    const p = reelPrompt(input, locale)
    const raw = await generateJSON<Partial<ReelScript>>(p.user, { system: p.system, temperature: 0.85 })
    return {
      hook: raw.hook || '',
      beats: raw.beats || [],
      cta: raw.cta || '',
      caption: raw.caption || '',
      hashtags: dedupe(raw.hashtags || []),
      estimatedSeconds: raw.estimatedSeconds || 40,
    }
  })
}

// ── 6. FAQ + featured snippet + cta + tags ─────────────────────────
export interface FaqBundle { faq: FaqItem[]; featuredSnippet: string; cta: string; tags: string[] }
export async function genFaq({ input, locale }: GenCtx): Promise<FaqBundle> {
  return cached('faq', { input, locale, v: PROMPT_VERSION }, async () => {
    await withGuards('faq')
    const p = faqPrompt(input, locale)
    const raw = await generateJSON<Partial<FaqBundle>>(p.user, { system: p.system, temperature: 0.5 })
    return {
      faq: raw.faq || [],
      featuredSnippet: raw.featuredSnippet || '',
      cta: raw.cta || 'Check any suspicious message free at ScamCheck.',
      tags: dedupe(raw.tags || []),
    }
  })
}

// ── helpers ────────────────────────────────────────────────────────
export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 70)
}
function clamp(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'
}
function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map((x) => x.trim()).filter(Boolean))]
}
