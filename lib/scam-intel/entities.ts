// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/entities.ts
// The data moat: a canonical scam-entity registry with aliases and a
// relationship graph (entity ↔ entity edges). Built deterministically
// from the SEO facet data + hub graph; clusters supply live fingerprints.
// This structured layer is what competitors can't cheaply copy.
// ─────────────────────────────────────────────────────────────────

import { SCAM_TYPES, BANKS, UPI_APPS, PLATFORMS } from '@/lib/seo/facets'
import { HUBS } from '@/lib/seo/hubs'

export interface CanonicalEntity {
  id: string
  kind: 'scam_type' | 'bank' | 'upi' | 'platform' | 'hub'
  name: string
  nameHi?: string
  aliases: string[]
  url: string
}

export interface EntityEdge { from: string; to: string; relation: 'targets' | 'impersonates' | 'used-on' | 'cluster-of' | 'related' }

export interface EntityGraph {
  entities: CanonicalEntity[]
  edges: EntityEdge[]
}

/** Build the canonical entity graph (deterministic; safe to cache/serve). */
export function buildEntityGraph(): EntityGraph {
  const entities: CanonicalEntity[] = []
  const edges: EntityEdge[] = []

  for (const t of SCAM_TYPES) entities.push({ id: `type:${t.id}`, kind: 'scam_type', name: t.name, nameHi: t.nameHi, aliases: t.aka, url: `/scams/type/${t.id}` })
  for (const b of BANKS) entities.push({ id: `bank:${b.id}`, kind: 'bank', name: b.name, aliases: [], url: `/scams/bank/${b.id}` })
  for (const u of UPI_APPS) entities.push({ id: `upi:${u.id}`, kind: 'upi', name: u.name, aliases: [], url: `/scams/upi/${u.id}` })
  for (const p of PLATFORMS) entities.push({ id: `platform:${p.id}`, kind: 'platform', name: p.name, aliases: [], url: `/scams/platform/${p.id}` })
  for (const h of HUBS) {
    entities.push({ id: `hub:${h.id}`, kind: 'hub', name: h.title, nameHi: h.titleHi, aliases: [], url: `/scams/hub/${h.id}` })
    for (const tid of h.typeIds) edges.push({ from: `hub:${h.id}`, to: `type:${tid}`, relation: 'cluster-of' })
    for (const rh of h.relatedHubs || []) edges.push({ from: `hub:${h.id}`, to: `hub:${rh}`, relation: 'related' })
  }

  // Heuristic cross-edges (which scams target banks / use platforms).
  const financialTypes = ['kyc-fraud', 'otp-fraud', 'upi-fraud', 'phishing']
  for (const b of BANKS) for (const t of financialTypes) edges.push({ from: `type:${t}`, to: `bank:${b.id}`, relation: 'impersonates' })
  for (const u of UPI_APPS) edges.push({ from: 'type:upi-fraud', to: `upi:${u.id}`, relation: 'used-on' })
  const msgTypes = ['phishing', 'fake-job', 'investment-fraud', 'lottery-scam']
  for (const p of PLATFORMS) for (const t of msgTypes) edges.push({ from: `type:${t}`, to: `platform:${p.id}`, relation: 'used-on' })

  return { entities, edges }
}

export function entityGraphSummary(): { entities: number; edges: number; byKind: Record<string, number> } {
  const g = buildEntityGraph()
  const byKind: Record<string, number> = {}
  for (const e of g.entities) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1
  return { entities: g.entities.length, edges: g.edges.length, byKind }
}
