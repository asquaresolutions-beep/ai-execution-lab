// lib/trustseal/verify/collectors/reputation.ts  (asq-trustseal-c1b)
// REUSES the existing scam-intel reputation engine (intel-graph). Maps its verdict
// to a TrustSeal reputation signal; a malicious verdict carries an intel_graph cap.
import type { Collector, CollectorContext, CollectorOutput, Signal } from '../types'
import { domainReputation } from '@/lib/scam-intel/reputation'

export const reputationCollector: Collector = {
  id: 'reputation',
  tier: 'mvp',
  timeoutMs: 2000,
  async collect(ctx: CollectorContext): Promise<CollectorOutput> {
    const start = Date.now()
    try {
      const r = domainReputation(ctx.domain)
      const rep = String(r.reputation).toLowerCase()
      const score = rep === 'trusted' ? 92 : rep === 'malicious' || rep === 'fraud' ? 5 : rep === 'suspicious' ? 25 : 55
      const sig: Signal = {
        id: 'reputation.intel_graph',
        category: 'reputation',
        status: 'ok',
        score,
        value: r.reputation,
        evidence: (r.reason || '').slice(0, 160),
        source: 'intel-graph',
        observedAt: ctx.now,
        ...(rep === 'malicious' || rep === 'fraud' ? { cap: 'intel_graph' as const, value: true } : {}),
      }
      return { signals: [sig], ms: Date.now() - start }
    } catch (err) {
      return { signals: [{ id: 'reputation.intel_graph', category: 'reputation', status: 'error', score: 0, source: 'intel-graph', observedAt: ctx.now }], ms: Date.now() - start, error: (err as Error).message }
    }
  },
}
