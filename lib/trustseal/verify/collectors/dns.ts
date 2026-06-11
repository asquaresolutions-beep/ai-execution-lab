// lib/trustseal/verify/collectors/dns.ts  (asq-trustseal-c1b)
// DNS signals: resolution, MX (real mail), SPF/DMARC email-auth. Read-only lookups.
import type { Collector, CollectorContext, CollectorOutput, Signal } from '../types'
import { resolve4, resolveMx, resolveTxt } from 'node:dns/promises'
import { allResolvedPublic } from '../ssrf'

export const dnsCollector: Collector = {
  id: 'dns',
  tier: 'mvp',
  timeoutMs: 4000,
  async collect(ctx: CollectorContext): Promise<CollectorOutput> {
    const start = Date.now()
    const at = ctx.now
    const signals: Signal[] = []
    try {
      const a = await resolve4(ctx.domain).catch(() => [] as string[])
      const resolves = a.length > 0 && allResolvedPublic(a)
      signals.push({
        id: 'dns.resolves', category: 'dns', status: a.length ? 'ok' : 'missing',
        score: resolves ? 100 : 0, value: resolves,
        ...(a.length && !resolves ? { cap: 'unreachable' as const, value: true } : {}),
        evidence: `${a.length} A record(s)`, source: 'dns', observedAt: at,
      })
      const mx = await resolveMx(ctx.domain).catch(() => [] as { exchange: string }[])
      signals.push({ id: 'dns.mx', category: 'dns', status: 'ok', score: mx.length ? 100 : 40, value: mx.length > 0, evidence: `${mx.length} MX`, source: 'dns', observedAt: at })
      const txt = (await resolveTxt(ctx.domain).catch(() => [] as string[][])).map((r) => r.join(''))
      const spf = txt.some((t) => /^v=spf1/i.test(t))
      const dmarc = (await resolveTxt(`_dmarc.${ctx.domain}`).catch(() => [] as string[][])).map((r) => r.join('')).some((t) => /^v=DMARC1/i.test(t))
      signals.push({ id: 'dns.email_auth', category: 'dns', status: 'ok', score: (spf ? 50 : 0) + (dmarc ? 50 : 0), value: `spf:${spf} dmarc:${dmarc}`, source: 'dns', observedAt: at })
      return { signals, ms: Date.now() - start }
    } catch (err) {
      return { signals: signals.length ? signals : [{ id: 'dns.resolves', category: 'dns', status: 'error', score: 0, source: 'dns', observedAt: at }], ms: Date.now() - start, error: (err as Error).message }
    }
  },
}
