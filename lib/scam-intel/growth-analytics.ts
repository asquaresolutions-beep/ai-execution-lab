// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/growth-analytics.ts
// Growth intelligence: which scam topics/entities to prioritise.
//
// - discoverCandidates(): fresh, viral, high-severity clusters most likely
//   to earn a Google Discover slot now.
// - fastestGrowingEntities(): platforms/regions/categories rising fastest.
// - topicLeverage(): blends search-demand tier (RPM proxy) + momentum to
//   rank highest-leverage topics to publish/promote.
// Derived from clusters already in the store — no extra AI, bounded reads.
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'
import { SCAM_TYPES, SCAM_TYPE_BY_ID } from '@/lib/seo/facets'
import { trending } from './feed'
import type { ScamCluster, TrendingItem } from './types'

// RPM proxy by category (advertiser demand; see monetization doc).
const RPM_TIER: Record<string, 'high' | 'medium' | 'volume'> = {
  investment_fraud: 'high', loan_scam: 'high', tech_support: 'high',
  upi_fraud: 'medium', kyc_fraud: 'medium', phishing: 'medium', fake_job: 'medium',
  otp_fraud: 'volume', lottery_prize: 'volume', courier_customs: 'volume', romance: 'volume', whatsapp_scam: 'volume',
}

export interface DiscoverCandidate {
  clusterId: string
  title: string
  category: string
  score: number          // 0..100 Discover-readiness
  reasons: string[]
}

export async function discoverCandidates(limit = 10): Promise<DiscoverCandidate[]> {
  const items = await trending(50)
  const now = Date.now()
  return items
    .map((it) => {
      const reasons: string[] = []
      let score = 0
      if (it.viral) { score += 35; reasons.push('viral momentum') }
      if (it.active) { score += 20; reasons.push('active in last 72h') }
      if (it.severity === 'high' || it.severity === 'critical') { score += 20; reasons.push(`${it.severity} severity`) }
      score += Math.min(15, it.reportCount * 2)
      const ageH = (now - it.lastSeen) / 3_600_000
      if (ageH < 24) { score += 10; reasons.push('reported today') }
      return { clusterId: it.clusterId, title: it.title, category: it.category, score: Math.min(100, score), reasons }
    })
    .filter((c) => c.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export interface EntityGrowth { entity: string; kind: 'category' | 'platform' | 'region'; count: number; recent: number; growth: number }

export async function fastestGrowingEntities(windowDays = 7, limit = 10): Promise<EntityGrowth[]> {
  const now = Date.now()
  const cutoff = now - windowDays * 86_400_000
  const clusters = (await getStore().query<ScamCluster>('scam_clusters', { limit: 1000 })).map((r) => r.data)
  const acc = new Map<string, EntityGrowth>()
  const bump = (entity: string, kind: EntityGrowth['kind'], c: ScamCluster) => {
    if (!entity || entity === 'unknown') return
    const key = `${kind}:${entity}`
    const e = acc.get(key) ?? { entity, kind, count: 0, recent: 0, growth: 0 }
    e.count += c.reportCount
    if (c.lastSeen >= cutoff) e.recent += c.reportCount
    acc.set(key, e)
  }
  for (const c of clusters) {
    bump(c.category, 'category', c)
    for (const p of c.platforms) bump(p, 'platform', c)
    for (const r of c.regions) bump(r, 'region', c)
  }
  const out = [...acc.values()]
  for (const e of out) e.growth = e.count > 0 ? +(e.recent / e.count).toFixed(3) : 0
  return out.sort((a, b) => b.recent - a.recent || b.growth - a.growth).slice(0, limit)
}

export interface TopicLeverage { typeId: string; name: string; rpmTier: string; demandTier: number; momentum: number; leverage: number }

export async function topicLeverage(): Promise<TopicLeverage[]> {
  const items = await trending(100)
  const momentumByCat = new Map<string, number>()
  for (const it of items) momentumByCat.set(it.category, Math.max(momentumByCat.get(it.category) ?? 0, it.momentum))
  return SCAM_TYPES.map((t) => {
    const catKey = t.id.replace(/-/g, '_')
    const rpmTier = RPM_TIER[catKey] ?? 'volume'
    const rpmWeight = rpmTier === 'high' ? 1 : rpmTier === 'medium' ? 0.7 : 0.4
    const demand = t.searchVolumeTier === 1 ? 1 : t.searchVolumeTier === 2 ? 0.6 : 0.3
    const momentum = momentumByCat.get(catKey) ?? 0
    const leverage = +((demand * 0.5 + rpmWeight * 0.3 + momentum * 0.2) * 100).toFixed(1)
    return { typeId: t.id, name: t.name, rpmTier, demandTier: t.searchVolumeTier, momentum, leverage }
  }).sort((a, b) => b.leverage - a.leverage)
}

export { SCAM_TYPE_BY_ID }
export type { TrendingItem }
