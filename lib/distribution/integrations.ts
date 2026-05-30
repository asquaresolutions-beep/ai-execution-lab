// ─────────────────────────────────────────────────────────────────
// lib/distribution/integrations.ts
// Channel publishing adapters.
//
// Each adapter implements `PublishAdapter`. Today only `markdown-export`
// and `internal-store` are "live"; the WordPress / LinkedIn / YouTube
// Shorts adapters are wired as ready-to-implement stubs that already
// accept the right inputs and surface the exact credentials they need.
// Flipping them on = filling in the fetch call, no architecture change.
// ─────────────────────────────────────────────────────────────────

import { getBundle } from './engine'
import { toMarkdown, toHTML } from './export'
import type { Locale } from './types'

export type Channel =
  | 'internal-store'
  | 'markdown-export'
  | 'wordpress'
  | 'linkedin'
  | 'twitter'
  | 'youtube-shorts'

export interface PublishResult extends Record<string, unknown> {
  channel: Channel
  status: 'published' | 'prepared'
  ref?: string          // external id / url when available
  note?: string
}

export interface PublishAdapter {
  channel: Channel
  /** True when real external credentials are present. */
  ready(): boolean
  publish(bundleId: string, locale: Locale): Promise<PublishResult>
}

// ── Live: internal store (mark as published in our own DB) ─────────
const internalStore: PublishAdapter = {
  channel: 'internal-store',
  ready: () => true,
  async publish(bundleId) {
    return { channel: 'internal-store', status: 'published', ref: bundleId }
  },
}

// ── Live: markdown export (returns rendered artifact) ──────────────
const markdownExport: PublishAdapter = {
  channel: 'markdown-export',
  ready: () => true,
  async publish(bundleId, locale) {
    const bundle = await mustGet(bundleId)
    return {
      channel: 'markdown-export', status: 'prepared',
      note: 'Rendered markdown artifact',
      markdown: toMarkdown(bundle, locale),
    }
  },
}

// ── Future: WordPress REST publishing ──────────────────────────────
// Needs: WORDPRESS_API_URL, WORDPRESS_USER, WORDPRESS_APP_PASSWORD.
// POST /wp-json/wp/v2/posts  { title, content (html), status, slug }.
const wordpress: PublishAdapter = {
  channel: 'wordpress',
  ready: () => !!(process.env.WORDPRESS_API_URL && process.env.WORDPRESS_APP_PASSWORD),
  async publish(bundleId, locale) {
    const bundle = await mustGet(bundleId)
    const html = toHTML(bundle, locale)
    if (!this.ready()) {
      return { channel: 'wordpress', status: 'prepared', note: 'WordPress credentials not set — artifact prepared, not posted', htmlPreview: html.slice(0, 200) }
    }
    // TODO(go-live): POST to `${WORDPRESS_API_URL}/wp-json/wp/v2/posts`
    // with Basic auth (user:app_password), body { title, content: html,
    // status: 'draft', slug }. Return the created post id/url as `ref`.
    throw new NotImplemented('wordpress')
  },
}

// ── Future: LinkedIn UGC posts ─────────────────────────────────────
// Needs: LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN.
// POST https://api.linkedin.com/v2/ugcPosts.
const linkedin: PublishAdapter = {
  channel: 'linkedin',
  ready: () => !!(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN),
  async publish(bundleId, locale) {
    const bundle = await mustGet(bundleId)
    const text = bundle.locales[locale]?.social.linkedin || ''
    if (!this.ready()) {
      return { channel: 'linkedin', status: 'prepared', note: 'LinkedIn token not set — copy prepared', text }
    }
    // TODO(go-live): POST ugcPosts with author=LINKEDIN_AUTHOR_URN,
    // shareCommentary=text, lifecycleState=PUBLISHED.
    throw new NotImplemented('linkedin')
  },
}

// ── Future: X / Twitter ────────────────────────────────────────────
const twitter: PublishAdapter = {
  channel: 'twitter',
  ready: () => !!process.env.TWITTER_BEARER_TOKEN,
  async publish(bundleId, locale) {
    const bundle = await mustGet(bundleId)
    const text = bundle.locales[locale]?.social.twitter || ''
    if (!this.ready()) return { channel: 'twitter', status: 'prepared', note: 'X token not set — copy prepared', text }
    throw new NotImplemented('twitter')
  },
}

// ── Future: YouTube Shorts pipeline ────────────────────────────────
// Needs: a rendering step (script -> TTS -> video) + YouTube Data API
// upload. Adapter prepares the script package for the render worker.
const youtubeShorts: PublishAdapter = {
  channel: 'youtube-shorts',
  ready: () => false, // requires external render worker
  async publish(bundleId, locale) {
    const bundle = await mustGet(bundleId)
    const reel = bundle.locales[locale]?.reel
    return {
      channel: 'youtube-shorts', status: 'prepared',
      note: 'Reel script package prepared for render worker (TTS + caption burn-in + Data API upload).',
      script: reel as unknown as Record<string, unknown>,
    }
  },
}

const ADAPTERS: Record<Channel, PublishAdapter> = {
  'internal-store': internalStore,
  'markdown-export': markdownExport,
  wordpress,
  linkedin,
  twitter,
  'youtube-shorts': youtubeShorts,
}

export async function publishToChannel(channel: Channel, bundleId: string, locale: Locale): Promise<PublishResult> {
  const adapter = ADAPTERS[channel]
  if (!adapter) throw new Error(`Unknown channel: ${channel}`)
  return adapter.publish(bundleId, locale)
}

export function channelReadiness(): Record<Channel, boolean> {
  return Object.fromEntries(
    (Object.keys(ADAPTERS) as Channel[]).map((c) => [c, ADAPTERS[c].ready()]),
  ) as Record<Channel, boolean>
}

class NotImplemented extends Error {
  constructor(channel: string) {
    super(`Channel "${channel}" integration is wired but not yet implemented. See TODO(go-live).`)
    this.name = 'NotImplemented'
  }
}
async function mustGet(bundleId: string) {
  const b = await getBundle(bundleId)
  if (!b) throw new Error(`Bundle not found: ${bundleId}`)
  return b
}
