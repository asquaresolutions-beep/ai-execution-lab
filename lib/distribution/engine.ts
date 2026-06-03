// ─────────────────────────────────────────────────────────────────
// lib/distribution/engine.ts
// Orchestrator: ScamInput -> complete bilingual ContentBundle.
// Composes the individual generators, builds schema + links, persists
// the bundle, indexes it for future internal-linking, and audits.
// ─────────────────────────────────────────────────────────────────

import { getProvider } from '@/lib/ai/provider'
import { getStore, genId } from '@/lib/store/adapter'
import { embed } from '@/lib/ai/embeddings'
import { audit } from '@/lib/ai/audit'
import {
  genArticle, genSeo, genGeo, genSocial, genReel, genFaq, slugify,
} from './generators'
import { buildInternalLinks } from './linking'
import { buildFaqSchema, buildArticleSchema } from './schema'
import type {
  ScamInput, Locale, ContentBundle, LocalizedContent,
} from './types'

const LOCALES: Locale[] = ['en', 'hi']

export interface GenerateBundleOptions {
  locales?: Locale[]
  persist?: boolean
}

async function generateLocale(input: ScamInput, locale: Locale): Promise<LocalizedContent> {
  const ctx = { input, locale }
  // Independent generations run concurrently — big latency win.
  const [article, seo, geo, social, reel, faqBundle] = await Promise.all([
    genArticle(ctx), genSeo(ctx), genGeo(ctx), genSocial(ctx), genReel(ctx), genFaq(ctx),
  ])
  return {
    locale,
    article,
    seo,
    geo,
    social,
    reel,
    faq: faqBundle.faq,
    featuredSnippet: faqBundle.featuredSnippet,
    cta: faqBundle.cta,
    tags: faqBundle.tags,
    keywords: seo.keywords,
  }
}

export async function generateBundle(
  input: ScamInput,
  opts: GenerateBundleOptions = {},
): Promise<ContentBundle> {
  const locales = opts.locales ?? LOCALES
  const id = genId('bundle_')
  const provider = getProvider()

  // Generate every requested locale concurrently.
  const localeResults = await Promise.all(locales.map((l) => generateLocale(input, l)))
  const localeMap = Object.fromEntries(
    locales.map((l, i) => [l, localeResults[i]]),
  ) as Record<Locale, LocalizedContent>

  // Use the English (or first) locale to drive links + schema.
  const primary = localeMap[locales[0]]
  const { internalLinks, relatedPages } = await buildInternalLinks(input, primary.keywords)

  const bundle: ContentBundle = {
    id,
    input,
    createdAt: Date.now(),
    provider: provider.name,
    live: provider.live,
    locales: localeMap,
    internalLinks,
    relatedPages,
    faqSchema: buildFaqSchema(primary.faq),
    articleSchema: buildArticleSchema(input, primary.seo, {
      locale: locales[0] === 'hi' ? 'hi-IN' : 'en-IN',
    }),
  }

  if (opts.persist !== false) {
    await persistBundle(bundle)
  }
  await audit({
    action: 'distribution.bundle', actor: 'system', subject: id, ok: true,
    meta: { provider: provider.name, live: provider.live, locales },
  })
  return bundle
}

async function persistBundle(bundle: ContentBundle): Promise<void> {
  const store = getStore()
  await store.set('content_bundles', bundle.id, bundle as unknown as Record<string, unknown>)

  // Index into `alerts` so future bundles can internally link to this one.
  const primary = bundle.locales.en ?? Object.values(bundle.locales)[0]
  const slug = primary?.seo.slug || slugify(bundle.input.title)
  const { vector } = await embed(`${bundle.input.title} ${bundle.input.description}`)
  await store.set('alerts', slug, {
    id: slug,
    bundleId: bundle.id,
    title: bundle.input.title,
    slug,
    platform: bundle.input.platform,
    region: bundle.input.region,
    severity: bundle.input.severity,
    keywords: primary?.keywords ?? [],
    vector,
    publishedAt: bundle.createdAt,
  })
}

export async function getBundle(id: string): Promise<ContentBundle | null> {
  const doc = await getStore().get<ContentBundle>('content_bundles', id)
  return doc ? (doc.data as ContentBundle) : null
}

export async function listBundles(limit = 50): Promise<ContentBundle[]> {
  const rows = await getStore().query<ContentBundle>('content_bundles', {
    orderBy: { field: 'createdAt', dir: 'desc' }, limit,
  })
  return rows.map((r) => r.data as ContentBundle)
}
