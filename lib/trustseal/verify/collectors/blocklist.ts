// lib/trustseal/verify/collectors/blocklist.ts  (asq-trustseal-c1b)
// Blocklist signals (category: reputation). URLhaus (free, no key) always; Google
// Safe Browsing when GOOGLE_SAFE_BROWSING_KEY is set. ANY hit → blocklist cap (≤15).
import type { Collector, CollectorContext, CollectorOutput, Signal } from '../types'

async function urlhausHit(domain: string, signal: AbortSignal): Promise<boolean | null> {
  try {
    const res = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `host=${encodeURIComponent(domain)}`,
    })
    if (!res.ok) return null
    const j = (await res.json()) as { query_status?: string; urls?: unknown[] }
    if (j.query_status === 'no_results') return false
    if (j.query_status === 'ok') return Array.isArray(j.urls) && j.urls.length > 0
    return null
  } catch { return null }
}

async function safeBrowsingHit(domain: string, key: string, signal: AbortSignal): Promise<boolean | null> {
  try {
    const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`, {
      method: 'POST', signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'trustseal', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
          platformTypes: ['ANY_PLATFORM'], threatEntryTypes: ['URL'],
          threatEntries: [{ url: `http://${domain}/` }, { url: `https://${domain}/` }],
        },
      }),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { matches?: unknown[] }
    return Array.isArray(j.matches) && j.matches.length > 0
  } catch { return null }
}

export const blocklistCollector: Collector = {
  id: 'blocklist',
  tier: 'mvp',
  timeoutMs: 5000,
  async collect(ctx: CollectorContext): Promise<CollectorOutput> {
    const start = Date.now()
    const at = ctx.now
    const key = process.env.GOOGLE_SAFE_BROWSING_KEY || ''
    const [uh, sb] = await Promise.all([
      urlhausHit(ctx.domain, ctx.signal),
      key ? safeBrowsingHit(ctx.domain, key, ctx.signal) : Promise.resolve(null),
    ])
    const checked = [uh, sb].filter((v) => v !== null) as boolean[]
    if (checked.length === 0) {
      // no provider answered → missing (neutral, lowers confidence; reputation cat may still be covered by intel-graph)
      return { signals: [{ id: 'blocklist.providers', category: 'reputation', status: 'missing', score: 0, source: 'blocklist', observedAt: at }], ms: Date.now() - start, error: 'no_provider' }
    }
    const hit = checked.some(Boolean)
    const sig: Signal = {
      id: 'blocklist.match', category: 'reputation', status: 'ok',
      score: hit ? 0 : 95, value: hit,
      ...(hit ? { cap: 'blocklist' as const } : {}),
      evidence: `urlhaus:${uh ?? 'na'} safebrowsing:${sb ?? 'na'}`,
      source: 'blocklist', observedAt: at,
    }
    return { signals: [sig], ms: Date.now() - start }
  },
}
