// ─────────────────────────────────────────────────────────────────
// lib/trustseal/verify/verify.ts  (asq-trustseal-c1b)
// verifyBusiness() orchestrator. Collectors are INJECTED (the real MVP registry
// lives in registry.ts) so this module imports only pure deps (types/score/
// normalize) and stays node --experimental-strip-types testable.
//   • normalize → eTLD+1 (apex policy)
//   • single-flight: concurrent verifies of the same canonical domain share one run
//   • each collector isolated: per-collector AbortController timeout, errors → signals
//     marked error/timeout (scoring applies the transparency penalty)
//   • aggregate via scoreVerification; never throws for a single bad collector
// No persistence/cache here (that's C1C) — pure compute over injected collectors.
// ─────────────────────────────────────────────────────────────────
import type { Collector, CollectorContext, Signal, VerifyResult, VerifyTier } from './types'
import { normalizeDomain, verifyDocId } from './normalize'
import { scoreVerification, SIGNAL_SCHEMA_VERSION, WEIGHTS_VERSION } from './score'

export interface VerifyOptions {
  name?: string
  country?: string
  tier?: VerifyTier
  now?: number
  ttlSeconds?: number
}
export interface VerifyDeps { collectors: Collector[] }

export class InvalidDomainError extends Error {}

const inflight = new Map<string, Promise<VerifyResult>>()

export async function verifyBusiness(rawDomain: string, deps: VerifyDeps, opts: VerifyOptions = {}): Promise<VerifyResult> {
  const norm = normalizeDomain(rawDomain)
  if (!norm) throw new InvalidDomainError('invalid_domain')
  const tier = opts.tier ?? 'mvp'
  const key = `${norm.canonical}|${tier}|${opts.country ?? ''}`
  const existing = inflight.get(key)
  if (existing) return existing                                   // single-flight

  const run = (async (): Promise<VerifyResult> => {
    const now = opts.now ?? Date.now()
    const ttlSeconds = opts.ttlSeconds ?? 86400
    const ctxBase = { domain: norm.canonical, inputName: opts.name, country: opts.country, tier, now }

    const collectors = deps.collectors.filter((c) => tierAllows(tier, c.tier))
    const results = await Promise.allSettled(collectors.map((c) => runCollector(c, ctxBase)))

    const signals: Signal[] = []
    let partial = false
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') { signals.push(...r.value.signals); if (r.value.error) partial = true }
      else { partial = true; signals.push(failSignal(collectors[i], now)) }
    })

    const s = scoreVerification({ signals, ageSeconds: 0, ttlSeconds })
    return {
      ...s,
      id: verifyDocId(norm.canonical),
      domain: norm.canonical,
      inputDomain: norm.input,
      inputName: opts.name,
      country: opts.country,
      signals,
      tier,
      partial,
      checkedAt: now,
      ttlSeconds,
      signalSchemaVersion: SIGNAL_SCHEMA_VERSION,
      weightsVersion: WEIGHTS_VERSION,
    }
  })()

  inflight.set(key, run)
  try { return await run } finally { inflight.delete(key) }
}

function tierAllows(requested: VerifyTier, collectorTier: VerifyTier): boolean {
  const rank: Record<VerifyTier, number> = { mvp: 0, phase2: 1, enterprise: 2 }
  return rank[collectorTier] <= rank[requested]
}

async function runCollector(c: Collector, base: Omit<CollectorContext, 'signal'>): Promise<{ signals: Signal[]; error?: string }> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), c.timeoutMs)
  try {
    const out = await c.collect({ ...base, signal: ac.signal })
    return { signals: out.signals, error: out.error }
  } catch (err) {
    return { signals: [], error: (err as Error)?.message || 'collector_error' }
  } finally {
    clearTimeout(timer)
  }
}

// A collector that rejected/aborted with no signals → record one error signal so the
// transparency penalty applies (a hard-category collector failing isn't "neutral").
function failSignal(c: Collector, now: number): Signal {
  const cat = COLLECTOR_CATEGORY[c.id] ?? 'web'
  return { id: `${c.id}.unavailable`, category: cat, status: 'error', score: 0, source: c.id, observedAt: now }
}

const COLLECTOR_CATEGORY: Record<string, Signal['category']> = {
  dns: 'dns', tls: 'ssl', rdap: 'whois', blocklist: 'reputation', reputation: 'reputation', impersonation: 'impersonation',
}
