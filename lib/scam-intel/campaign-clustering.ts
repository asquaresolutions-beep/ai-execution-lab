// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/campaign-clustering.ts
// Group scam reports into CAMPAIGNS using multiple signals: shared domain,
// shared UPI handle, shared phone, identical wording skeleton, and identical
// fingerprint. Union-find over strong shared keys → robust campaign grouping
// even when one signal is missing. Pure (operates on records you already have).
// Embedding-similarity clustering is available separately in clustering.ts.
// (goals 4, 8)
// ─────────────────────────────────────────────────────────────────

export interface CampaignRecord {
  id: string
  label: string                 // fingerprint label
  fingerprint: string
  domainCore: string | null
  structureHash: string
  upiIds: string[]
  phones: string[]
  category: string
  createdAt?: number            // epoch ms (for growth); optional
}

export interface Campaign {
  id: number
  label: string
  size: number
  memberIds: string[]
  sharedDomains: string[]
  sharedUpiIds: string[]
  sharedPhones: string[]
  categories: Record<string, number>
  confidence: number            // 0..1 — strength of the shared signal
  firstSeen?: number
  lastSeen?: number
  growth24h?: number            // members seen in the last 24h (campaign velocity)
}

// Link-shortener / aggregator SLDs are shared across UNRELATED campaigns, so
// they must NOT be used as a campaign-joining key (else everything merges).
const NON_DISTINCTIVE_DOMAINS = new Set(['bit', 'tinyurl', 'cutt', 't', 'wa', 'goo', 'rb', 'is', 'rebrand', 'tiny'])

export function clusterCampaigns(records: CampaignRecord[], now = Date.now()): Campaign[] {
  const n = records.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const union = (a: number, b: number) => { parent[find(a)] = find(b) }

  // Index strong keys → first record that used them; union on collision.
  const keyOwner = new Map<string, number>()
  const linkBy = (i: number, key: string | null | undefined) => {
    if (!key) return
    const owner = keyOwner.get(key)
    if (owner === undefined) keyOwner.set(key, i)
    else union(owner, i)
  }
  records.forEach((r, i) => {
    linkBy(i, r.domainCore && !NON_DISTINCTIVE_DOMAINS.has(r.domainCore) ? `d:${r.domainCore}` : null)
    linkBy(i, `s:${r.structureHash}`)          // identical wording skeleton
    linkBy(i, `f:${r.fingerprint}`)
    r.upiIds.forEach((u) => linkBy(i, `u:${u.toLowerCase()}`))
    r.phones.forEach((p) => linkBy(i, `p:${p}`))
  })

  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) { const root = find(i); (groups.get(root) ?? groups.set(root, []).get(root))!.push(i) }

  let cid = 0
  const out: Campaign[] = []
  for (const idxs of groups.values()) {
    const members = idxs.map((i) => records[i])
    const tally = <T>(sel: (r: CampaignRecord) => T[]) => {
      const m = new Map<string, number>()
      for (const r of members) for (const v of sel(r)) m.set(String(v), (m.get(String(v)) ?? 0) + 1)
      return m
    }
    const domains = tally((r) => (r.domainCore ? [r.domainCore] : []))
    const upis = tally((r) => r.upiIds)
    const phones = tally((r) => r.phones)
    const cats: Record<string, number> = {}
    for (const r of members) cats[r.category] = (cats[r.category] ?? 0) + 1
    const times = members.map((r) => r.createdAt).filter((t): t is number => typeof t === 'number')
    // Confidence: how concentrated the strongest shared key is across members.
    const topShare = (m: Map<string, number>) => (m.size ? Math.max(...m.values()) / members.length : 0)
    const confidence = Math.round(Math.max(topShare(domains), topShare(upis), topShare(phones), members.length > 1 ? 0.5 : 0.2) * 100) / 100
    const labelCounts = new Map<string, number>()
    for (const r of members) labelCounts.set(r.label, (labelCounts.get(r.label) ?? 0) + 1)
    const label = [...labelCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    out.push({
      id: cid++, label, size: members.length, memberIds: members.map((r) => r.id),
      sharedDomains: [...domains.keys()], sharedUpiIds: [...upis.keys()], sharedPhones: [...phones.keys()],
      categories: cats, confidence,
      firstSeen: times.length ? Math.min(...times) : undefined,
      lastSeen: times.length ? Math.max(...times) : undefined,
      growth24h: times.filter((t) => now - t <= 86_400_000).length || undefined,
    })
  }
  return out.sort((a, b) => b.size - a.size)
}

/** Fastest-growing campaigns (by 24h velocity, then size). (goal 8) */
export function fastestGrowing(campaigns: Campaign[], limit = 10): Campaign[] {
  return [...campaigns].filter((c) => c.size > 1).sort((a, b) => (b.growth24h ?? 0) - (a.growth24h ?? 0) || b.size - a.size).slice(0, limit)
}
