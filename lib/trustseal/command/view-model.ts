// ─────────────────────────────────────────────────────────────────
// lib/trustseal/command/view-model.ts
// PURE presentation helpers for the Command Center (no React, no store, no fetch):
// live/preview mode, live metrics, the signal-category network, terminal rows,
// event descriptions and client-side search over the already-loaded overview.
// Every value is derived from the CommandOverview returned by the server — nothing
// here invents counts, scores, domains, deltas or events.
// ─────────────────────────────────────────────────────────────────
import { bandMeta } from '@/lib/trustseal/band'
import type { CommandDomain, CommandMode, CommandOverview, CommandTimelineEvent } from './types'

/** LIVE once the account has at least one verified domain; otherwise PREVIEW. */
export function commandMode(verifiedDomains: number): CommandMode {
  return verifiedDomains > 0 ? 'live' : 'preview'
}

export type Tone = 'good' | 'cyan' | 'violet' | 'warn' | 'bad' | 'dim'

export const bandName = (band: string | null | undefined): string => (band ? bandMeta(band).name : 'Not scored')
export const bandColor = (band: string | null | undefined): string => (band ? bandMeta(band).color : '#5d6a86')

const CATEGORY_LABEL: Record<string, string> = {
  dns: 'DNS', ssl: 'SSL/TLS', reputation: 'Reputation', whois: 'WHOIS',
  impersonation: 'Impersonation', legitimacy: 'Legitimacy', web: 'Web presence',
}
export const categoryLabel = (c: string): string => CATEGORY_LABEL[c] ?? c

const STATUS_LABEL: Record<string, string> = {
  ok: 'OK', missing: 'Not found', not_applicable: 'Not applicable', blocked: 'Blocked', error: 'Could not be checked', timeout: 'Timed out',
}
export const signalStatusLabel = (s: string): string => STATUS_LABEL[s] ?? s

/** "whois.domain_age" → "WHOIS · domain age" */
export function signalLabel(id: string): string {
  const [cat, ...rest] = id.split('.')
  const name = rest.join('.').replace(/_/g, ' ')
  return name ? `${categoryLabel(cat)} · ${name}` : categoryLabel(cat)
}

export const verifiedDomains = (ov: CommandOverview): CommandDomain[] => ov.domains.filter((d) => d.status === 'verified')

/** Default focus: the verified domain with the most recent check (falls back to the first verified). */
export function primaryDomain(ov: CommandOverview): CommandDomain | null {
  const v = verifiedDomains(ov)
  if (!v.length) return null
  return [...v].sort((a, b) => (b.report?.checkedAt ?? 0) - (a.report?.checkedAt ?? 0))[0]
}

export interface MetricView { k: string; v: string; unit: string; tone: Tone }

/** Operational readouts from real counts only — no deltas or sparklines (no series exists for them). */
export function liveMetrics(ov: CommandOverview): MetricView[] {
  const s = ov.summary
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
  return [
    { k: 'Verified', v: String(s.verifiedDomains), unit: plural(s.verifiedDomains, 'domain', 'domains'), tone: 'good' },
    { k: 'Pending claims', v: String(s.pendingClaims), unit: 'awaiting DNS', tone: 'violet' },
    ov.entitlement.monitoring
      ? { k: 'Monitored', v: String(s.monitoredDomains), unit: plural(s.monitoredDomains, 'domain', 'domains'), tone: 'cyan' }
      : { k: 'Monitored', v: '—', unit: 'not in plan', tone: 'dim' },
    { k: 'Unread alerts', v: String(s.alerts.unread), unit: `of ${s.alerts.total}`, tone: s.alerts.critical > 0 ? 'bad' : s.alerts.unread > 0 ? 'warn' : 'good' },
  ]
}

export interface CategoryNode { id: string; category: string; covered: boolean; subScore: number | null; deg: number; dist: number; r: number }

/** Network nodes = the domain's own signal categories from its latest stored check. No other domains, no inferred links. */
export function categoryNodes(domain: CommandDomain | null): CategoryNode[] {
  const cats = domain?.report?.categories ?? []
  return cats.map((c, i) => ({
    id: `${categoryLabel(c.category)} ${c.covered ? c.subScore : 'n/a'}`,
    category: c.category,
    covered: c.covered,
    subScore: c.covered ? c.subScore : null,
    deg: -90 + (360 / cats.length) * i,
    dist: i % 2 === 0 ? 196 : 164,
    r: c.covered ? 10 : 7,
  }))
}

const BAND_RANK: Record<string, number> = { verified: 5, established: 4, limited: 3, caution: 2, high_risk: 1 }

export interface EventView { tag: string; text: string; tone: Tone }

/** Human description of a real timeline event. */
export function describeEvent(e: CommandTimelineEvent): EventView {
  switch (e.kind) {
    case 'claim_started': return { tag: 'CLAIM', text: 'Ownership claim started', tone: 'cyan' }
    case 'verified': return { tag: 'VRFY', text: 'Domain ownership verified', tone: 'good' }
    case 'reverified': return { tag: 'CHECK', text: `First recorded check · ${bandName(e.to)}`, tone: 'good' }
    case 'band': {
      const down = (BAND_RANK[e.to ?? ''] ?? 0) < (BAND_RANK[e.from ?? ''] ?? 0)
      return { tag: 'BAND', text: `Trust level ${bandName(e.from)} → ${bandName(e.to)}`, tone: down ? 'warn' : 'good' }
    }
    case 'score': return { tag: 'SCORE', text: `Trust score ${e.from} → ${e.to}`, tone: 'violet' }
    case 'ssl': return { tag: 'SSL', text: `SSL validity ${e.from} → ${e.to}`, tone: 'warn' }
    case 'dns': return { tag: 'DNS', text: `DNS resolution ${e.from} → ${e.to}`, tone: 'warn' }
    case 'alert': return { tag: 'ALERT', text: e.detail || 'Monitoring alert', tone: e.severity === 'critical' ? 'bad' : e.severity === 'warning' ? 'warn' : 'cyan' }
  }
}

export interface SearchResults {
  domains: CommandDomain[]
  verifications: CommandOverview['verifications']
  alerts: CommandOverview['risk']['alerts']
  signals: CommandOverview['risk']['signals']
  timeline: CommandTimelineEvent[]
  total: number
}

const PER_GROUP = 20

/** Client-side search over the loaded overview only. Every whitespace-separated term must match. */
export function searchOverview(ov: CommandOverview, query: string): SearchResults {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const empty: SearchResults = { domains: [], verifications: [], alerts: [], signals: [], timeline: [], total: 0 }
  if (!terms.length) return empty
  const hit = (...parts: (string | number | null | undefined)[]) => {
    const hay = parts.filter((p) => p != null).join(' ').toLowerCase()
    return terms.every((t) => hay.includes(t))
  }
  const domains = ov.domains.filter((d) => hit(d.domain, d.status, d.method, d.report && bandName(d.report.band), d.report?.score)).slice(0, PER_GROUP)
  const verifications = ov.verifications.filter((v) => hit(v.domain, bandName(v.band), v.score, 'verification check')).slice(0, PER_GROUP)
  const alerts = ov.risk.alerts.filter((a) => hit(a.domain, a.kind.replace(/_/g, ' '), a.severity, a.detail, 'alert risk monitoring', a.read ? 'read' : 'unread')).slice(0, PER_GROUP)
  const signals = ov.risk.signals.filter((s) => hit(s.domain, signalLabel(s.id), s.category, signalStatusLabel(s.status), s.evidence, 'signal risk')).slice(0, PER_GROUP)
  const timeline = ov.timeline.filter((e) => { const d = describeEvent(e); return hit(e.domain, d.tag, d.text) }).slice(0, PER_GROUP)
  return { domains, verifications, alerts, signals, timeline, total: domains.length + verifications.length + alerts.length + signals.length + timeline.length }
}
