// lib/trustseal/verify/collectors/impersonation.ts  (asq-trustseal-c1b)
// REUSES the existing brand-impersonation detector. A confirmed impersonation
// carries the impersonation cap (score ≤25).
import type { Collector, CollectorContext, CollectorOutput, Signal } from '../types'
import { detectImpersonation } from '@/lib/scam-intel/impersonation'

export const impersonationCollector: Collector = {
  id: 'impersonation',
  tier: 'mvp',
  timeoutMs: 2000,
  async collect(ctx: CollectorContext): Promise<CollectorOutput> {
    const start = Date.now()
    try {
      const r = detectImpersonation(ctx.domain)
      const sig: Signal = r.isImpersonation
        ? { id: 'impersonation.lookalike', category: 'impersonation', status: 'ok', score: 5, value: true, cap: 'impersonation', evidence: `${r.brand ?? ''} ${r.techniques.join(',')}`.trim().slice(0, 160), source: 'impersonation', observedAt: ctx.now }
        : { id: 'impersonation.lookalike', category: 'impersonation', status: 'ok', score: 90, value: false, evidence: 'no brand-impersonation patterns', source: 'impersonation', observedAt: ctx.now }
      return { signals: [sig], ms: Date.now() - start }
    } catch (err) {
      return { signals: [{ id: 'impersonation.lookalike', category: 'impersonation', status: 'error', score: 0, source: 'impersonation', observedAt: ctx.now }], ms: Date.now() - start, error: (err as Error).message }
    }
  },
}
