// lib/trustseal/verify/collectors/rdap.ts  (asq-trustseal-c1b)
// WHOIS via RDAP (free, structured). Signals: domain age (key, high abuse-resistance)
// + registrar. Recent registration is risk; recent transfer suppresses the age bonus.
import type { Collector, CollectorContext, CollectorOutput, Signal } from '../types'

interface RdapEvent { eventAction?: string; eventDate?: string }
interface RdapEntity { roles?: string[]; vcardArray?: unknown }
interface RdapResponse { events?: RdapEvent[]; entities?: RdapEntity[] }

function ageScore(days: number): number {
  if (days > 365 * 5) return 100
  if (days > 365 * 2) return 85
  if (days > 365) return 65
  if (days > 180) return 45
  if (days > 30) return 25
  return 10 // brand-new domain
}

export const rdapCollector: Collector = {
  id: 'rdap',
  tier: 'mvp',
  timeoutMs: 5000,
  async collect(ctx: CollectorContext): Promise<CollectorOutput> {
    const start = Date.now()
    const at = ctx.now
    try {
      const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(ctx.domain)}`, { signal: ctx.signal, headers: { accept: 'application/rdap+json' } })
      if (!res.ok) {
        const status = res.status === 404 ? 'missing' : 'error'
        return { signals: [{ id: 'whois.domain_age', category: 'whois', status, score: 0, source: 'rdap', observedAt: at }], ms: Date.now() - start, error: `rdap_${res.status}` }
      }
      const j = (await res.json()) as RdapResponse
      const events = j.events || []
      const reg = events.find((e) => e.eventAction === 'registration')?.eventDate
      const lastChanged = events.find((e) => e.eventAction === 'last changed' || e.eventAction === 'transfer')?.eventDate
      const regMs = reg ? Date.parse(reg) : NaN
      const days = isFinite(regMs) ? (at - regMs) / 86_400_000 : 0
      let score = isFinite(regMs) ? ageScore(days) : 50
      // recent transfer (<90d) suppresses the age bonus (aged-domain reuse evasion)
      const changedMs = lastChanged ? Date.parse(lastChanged) : NaN
      if (isFinite(changedMs) && at - changedMs < 90 * 86_400_000 && score > 50) score = 50
      const registrar = j.entities?.find((e) => e.roles?.includes('registrar')) ? 'present' : 'unknown'
      return {
        signals: [
          { id: 'whois.domain_age', category: 'whois', status: isFinite(regMs) ? 'ok' : 'missing', score, value: Math.round(days), evidence: reg ? `registered ${reg.slice(0, 10)}` : 'age unknown', source: 'rdap', observedAt: at },
          { id: 'whois.registrar', category: 'whois', status: 'ok', score: registrar === 'present' ? 80 : 50, value: registrar, source: 'rdap', observedAt: at },
        ],
        ms: Date.now() - start,
      }
    } catch (err) {
      return { signals: [{ id: 'whois.domain_age', category: 'whois', status: 'error', score: 0, source: 'rdap', observedAt: at }], ms: Date.now() - start, error: (err as Error).message }
    }
  },
}
