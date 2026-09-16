// ─────────────────────────────────────────────────────────────────
// lib/seo/indexnow.ts
// IndexNow eligibility + delta engine for the three Vercel-served hosts.
// Pure and deterministic: every function is a value-in/value-out decision so the
// rules can be unit-tested without network access. Network I/O lives in the
// runner script, never here.
//
// Deliberate design notes:
//  • WordPress (asquaresolution.com) is NOT handled here. It is owned by the
//    Rank Math "Instant Indexing" plugin. Its host is absent from
//    SUBMITTABLE_HOSTS, so a WordPress URL can never be submitted by this code.
//  • There is no allowlist of "public" path prefixes. Eligibility starts from
//    sitemap membership (the site's own statement of what is public) and then
//    subtracts. An allowlist would silently permit future private routes.
//  • app/sitemap.ts stamps most entries with `lastModified: new Date()`, i.e.
//    request time, so a raw lastmod diff would mark every URL "changed" on every
//    run. isVolatileLastmod() detects those synthetic stamps and the delta
//    ignores them — only genuinely dated entries (Lab content frontmatter) can
//    qualify as "changed". Added URLs are always a reliable signal.
// ─────────────────────────────────────────────────────────────────

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow'

/** IndexNow protocol limit. */
export const MAX_URLS_PER_REQUEST = 100

/** Conservative per-run cap. Subdomain quota is 100/day, 1500/month. */
export const DEFAULT_RUN_CAP = 50

/** Hosts this implementation may submit. WordPress is intentionally excluded. */
export const SUBMITTABLE_HOSTS: readonly string[] = Object.freeze([
  'scamcheck.asquaresolution.com',
  'trustseal.asquaresolution.com',
  'lab.asquaresolution.com',
])

/** Route families that are never submittable, mirroring robots.txt + product rules. */
const DENY_PREFIXES: readonly string[] = Object.freeze(['/api', '/ops', '/syndicate', '/embed'])

/** Hostnames that are never production canonical surfaces. */
function isNonProductionHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.vercel.app') ||
    hostname.startsWith('preview.') ||
    hostname.includes('-git-')
  )
}

function pathIsDenied(pathname: string): string | null {
  for (const p of DENY_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + '/')) return p
  }
  return null
}

/**
 * Checks that need no network access. Returns a rejection reason, or null when
 * the URL passes. `host` is the host whose batch this URL would join.
 */
export function staticCheck(raw: string, host: string): string | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return 'unparseable-url'
  }
  if (u.protocol !== 'https:') return 'not-https'
  // Reject anything the URL parser had to normalise (raw spaces, bad escapes).
  // e.g. ".../tags/REST API" normalises to ".../tags/REST%20API" → rejected.
  if (u.href !== raw) return 'not-percent-encoded'
  if (isNonProductionHost(u.hostname)) return 'non-production-host'
  if (!SUBMITTABLE_HOSTS.includes(u.hostname)) return 'host-not-submittable'
  if (u.hostname !== host) return 'foreign-host'
  if (u.hash) return 'has-fragment'
  const denied = pathIsDenied(u.pathname)
  if (denied) return `excluded-route:${denied}`
  return null
}

/** What a live fetch observed for a URL. */
export interface LiveProbe {
  status: number
  finalUrl: string
  robots: string
  canonical: string
}

/** Checks that require the live page. Returns a rejection reason, or null. */
export function liveCheck(raw: string, probe: LiveProbe): string | null {
  if (probe.status !== 200) return `http-${probe.status}`
  if (probe.finalUrl !== raw) return 'redirect'
  if (/noindex/i.test(probe.robots)) return 'noindex'
  if (!probe.canonical) return 'no-canonical'
  // Host first: a canonical pointing at another host is a distinct, more
  // serious defect than a same-host path mismatch, and deserves its own reason.
  try {
    if (new URL(probe.canonical).hostname !== new URL(raw).hostname) return 'cross-host-canonical'
  } catch {
    return 'unparseable-canonical'
  }
  if (probe.canonical !== raw) return 'canonical-mismatch'
  return null
}

export interface EligibilityResult {
  url: string
  eligible: boolean
  reason: string | null
}

/**
 * Full decision for one URL. `probe` may be omitted to run static checks only;
 * without a probe a URL is never eligible, because live state is mandatory.
 */
export function isEligible(raw: string, host: string, probe?: LiveProbe): EligibilityResult {
  const s = staticCheck(raw, host)
  if (s) return { url: raw, eligible: false, reason: s }
  if (!probe) return { url: raw, eligible: false, reason: 'no-live-probe' }
  const l = liveCheck(raw, probe)
  if (l) return { url: raw, eligible: false, reason: l }
  return { url: raw, eligible: true, reason: null }
}

// ── sitemap parsing + delta ──────────────────────────────────────

export interface SitemapEntry {
  loc: string
  lastmod: string | null
}

/** Minimal urlset parser. Returns entries in document order. */
export function parseSitemap(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = []
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = m[1]
    const loc = (block.match(/<loc>([\s\S]*?)<\/loc>/) || [, ''])[1].trim()
    if (!loc) continue
    const lm = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/)
    out.push({ loc: decodeXmlEntities(loc), lastmod: lm ? lm[1].trim() : null })
  }
  return out
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * True when a lastmod is within `windowMs` of when the sitemap was fetched —
 * the signature of a build/request-time stamp rather than a content date.
 * Such values carry no change information and must not drive submissions.
 */
export function isVolatileLastmod(lastmod: string | null, fetchedAt: number, windowMs = 3_600_000): boolean {
  if (!lastmod) return false
  const t = Date.parse(lastmod)
  if (Number.isNaN(t)) return false
  return Math.abs(fetchedAt - t) <= windowMs
}

export interface SitemapState {
  fetchedAt: number
  entries: Record<string, string | null>
}

export interface Delta {
  added: string[]
  changed: string[]
  unchanged: string[]
  ignoredVolatile: string[]
  removed: string[]
}

/** Snapshot helper: sitemap entries → comparable state. */
export function toState(entries: SitemapEntry[], fetchedAt: number): SitemapState {
  const map: Record<string, string | null> = {}
  for (const e of entries) map[e.loc] = e.lastmod
  return { fetchedAt, entries: map }
}

/**
 * Added URLs, plus URLs whose lastmod genuinely changed. A lastmod difference is
 * ignored when either side's stamp is volatile (≈ its own fetch time).
 * With no baseline, nothing is "changed" and nothing is "added": the first run
 * seeds state and submits nothing.
 */
export function computeDelta(baseline: SitemapState | null, current: SitemapState, windowMs = 3_600_000): Delta {
  const d: Delta = { added: [], changed: [], unchanged: [], ignoredVolatile: [], removed: [] }
  if (!baseline) {
    d.unchanged = Object.keys(current.entries)
    return d
  }
  for (const [loc, lastmod] of Object.entries(current.entries)) {
    if (!(loc in baseline.entries)) {
      d.added.push(loc)
      continue
    }
    const prev = baseline.entries[loc]
    if (prev === lastmod) {
      d.unchanged.push(loc)
      continue
    }
    const volatileNow = isVolatileLastmod(lastmod, current.fetchedAt, windowMs)
    const volatileBefore = isVolatileLastmod(prev, baseline.fetchedAt, windowMs)
    if (volatileNow || volatileBefore) d.ignoredVolatile.push(loc)
    else d.changed.push(loc)
  }
  for (const loc of Object.keys(baseline.entries)) {
    if (!(loc in current.entries)) d.removed.push(loc)
  }
  return d
}

// ── batching ─────────────────────────────────────────────────────

export interface Batch {
  host: string
  urls: string[]
}

/**
 * Groups URLs by their own hostname and splits each group into chunks of at most
 * `size`. A batch therefore never mixes hosts.
 */
export function batchByHost(urls: string[], size = MAX_URLS_PER_REQUEST): Batch[] {
  if (size < 1) throw new Error('batch size must be >= 1')
  const byHost = new Map<string, string[]>()
  for (const u of urls) {
    let h: string
    try {
      h = new URL(u).hostname
    } catch {
      continue
    }
    const list = byHost.get(h) ?? []
    list.push(u)
    byHost.set(h, list)
  }
  const out: Batch[] = []
  for (const [host, list] of byHost) {
    for (let i = 0; i < list.length; i += size) out.push({ host, urls: list.slice(i, i + size) })
  }
  return out
}

/** The JSON body IndexNow expects for one batch. */
export function buildPayload(batch: Batch, key: string, keyLocation: string) {
  return { host: batch.host, key, keyLocation, urlList: batch.urls }
}
