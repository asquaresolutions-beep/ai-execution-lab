// ─────────────────────────────────────────────────────────────────
// lib/distribution/prompts.ts
// Reusable, composable prompt templates. Every generator pulls from here
// so prompts are versioned in one place and easy to tune/A-B test.
//
// Convention: each builder returns { system, user } and asks for JSON
// where structured output is needed (parsed via generateJSON).
// ─────────────────────────────────────────────────────────────────

import type { ScamInput, Locale } from './types'

export const PROMPT_VERSION = '2026-05-30.1'

const LOCALE_NAME: Record<Locale, string> = { en: 'English', hi: 'Hindi (Devanagari script)' }

/** Shared safety + brand voice applied to all generations. */
export const BASE_SYSTEM = `You are the content engine for "ScamCheck" by A Square Solutions, a public-interest scam-awareness platform.
Voice: clear, factual, calm, protective — never sensational, never fear-mongering.
Audience: ordinary consumers, many non-technical, in India and worldwide.
Rules:
- Be accurate. Do NOT invent statistics, case numbers, or fake authorities.
- Never include real victims' personal data.
- Always orient the reader toward protective action and official reporting channels.
- Do not give instructions that could help a scammer.
- Output ONLY what is requested, in the requested format.
Search/answer-engine optimization (apply implicitly, never mention it):
- Lead with a direct, self-contained answer in the first sentence (wins AI Overviews & featured snippets).
- Use clear question-style headings and short, liftable paragraphs (good for Google Discover & generative engines).
- Prefer concrete, locally-relevant terms; for India use INR (₹), UPI, and the 1930 cybercrime helpline / cybercrime.gov.in where relevant.`

function inputBlock(s: ScamInput): string {
  return `SCAM INPUT
- Title: ${s.title}
- Description: ${s.description}
- Affected platform: ${s.platform}
- Region: ${s.region}
- Severity: ${s.severity}${s.sourceUrl ? `\n- Source: ${s.sourceUrl}` : ''}`
}

export interface BuiltPrompt { system: string; user: string }

// ── Article ────────────────────────────────────────────────────────
export function articlePrompt(s: ScamInput, locale: Locale): BuiltPrompt {
  return {
    system: BASE_SYSTEM,
    user: `${inputBlock(s)}

Write a complete scam-alert article in ${LOCALE_NAME[locale]} as GitHub-flavoured Markdown.
Structure:
1. An H1 title.
2. A 2-sentence summary paragraph (what it is, who is at risk).
3. "## How the scam works" — numbered steps from the victim's point of view.
4. "## Warning signs" — bullet list.
5. "## How to protect yourself" — bullet list of concrete actions.
6. "## What to do if you're targeted" — including the right official reporting channel for ${s.region}.
Length: 500–800 words. No fabricated numbers. Markdown only, no code fences.`,
  }
}

// ── SEO metadata (JSON) ────────────────────────────────────────────
export function seoPrompt(s: ScamInput, locale: Locale): BuiltPrompt {
  return {
    system: BASE_SYSTEM,
    user: `${inputBlock(s)}

Generate SEO metadata in ${LOCALE_NAME[locale]}. Return STRICT JSON:
{
  "metaTitle": "<= 60 chars, includes primary keyword",
  "metaDescription": "<= 155 chars, compelling, includes keyword",
  "slug": "kebab-case-english-slug-even-for-hindi",
  "ogTitle": "social share title",
  "ogDescription": "<= 110 chars",
  "keywords": ["8-12 search keywords"]
}`,
  }
}

// ── GEO / answer-engine summary (JSON) ─────────────────────────────
export function geoPrompt(s: ScamInput, locale: Locale): BuiltPrompt {
  return {
    system: BASE_SYSTEM,
    user: `${inputBlock(s)}

Produce a GEO (Generative Engine Optimization) summary in ${LOCALE_NAME[locale]} that AI answer engines can cite. Return STRICT JSON:
{
  "answer": "1-2 sentence direct answer to 'what is this scam and how do I avoid it'",
  "keyFacts": ["4-6 standalone factual statements an AI can quote verbatim"],
  "entities": ["named entities, platforms, synonyms, and related scam terms"]
}`,
  }
}

// ── Social copy (JSON) ─────────────────────────────────────────────
export function socialPrompt(s: ScamInput, locale: Locale): BuiltPrompt {
  return {
    system: BASE_SYSTEM,
    user: `${inputBlock(s)}

Write platform-native social posts in ${LOCALE_NAME[locale]} warning people about this scam. Return STRICT JSON:
{
  "linkedin": "professional, 3-5 short paragraphs, 1 CTA, 3 hashtags",
  "twitter": "single post <= 280 chars incl. hashtags",
  "twitterThread": ["3-5 tweets, each <= 280 chars"],
  "facebook": "friendly, shareable, emoji ok, 1 CTA",
  "threads": "casual, conversational, <= 480 chars",
  "reddit": { "title": "r/Scams-style title", "body": "markdown body, no clickbait", "subreddits": ["relevant subreddits"] }
}`,
  }
}

// ── Reel / Shorts script (JSON) ────────────────────────────────────
export function reelPrompt(s: ScamInput, locale: Locale): BuiltPrompt {
  return {
    system: BASE_SYSTEM,
    user: `${inputBlock(s)}

Write a 30-45 second vertical short-video script in ${LOCALE_NAME[locale]} (YouTube Shorts / Reels / TikTok). Return STRICT JSON:
{
  "hook": "first 3 seconds, pattern-interrupt opening line",
  "beats": ["3-6 spoken lines / on-screen captions in order"],
  "cta": "closing call to action",
  "caption": "post caption",
  "hashtags": ["6-10 hashtags"],
  "estimatedSeconds": 40
}`,
  }
}

// ── FAQ + featured snippet (JSON) ──────────────────────────────────
export function faqPrompt(s: ScamInput, locale: Locale): BuiltPrompt {
  return {
    system: BASE_SYSTEM,
    user: `${inputBlock(s)}

In ${LOCALE_NAME[locale]}, produce FAQ + a featured-snippet answer. Return STRICT JSON:
{
  "faq": [{ "question": "...", "answer": "concise 1-3 sentence answer" }],  // 4-6 items
  "featuredSnippet": "a single 40-55 word paragraph that directly answers the main query, optimised for position-zero",
  "cta": "one-line call to action",
  "tags": ["6-10 content tags"]
}`,
  }
}
