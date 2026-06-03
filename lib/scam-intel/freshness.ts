// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/freshness.ts
// Freshness + priority scoring for autonomous content selection.
// Combines recency, velocity (cluster growth), and severity so the
// autopilot spends its small per-run budget on the scams that matter
// most right now. Pure function — no AI, no extra reads.
// ─────────────────────────────────────────────────────────────────

import type { ScamCluster } from './types'
import { SEVERITY_RANK } from './severity'

export interface FreshnessScore {
  score: number          // 0..100
  recency: number
  velocity: number
  severity: number
}

export function freshnessScore(cluster: ScamCluster, now = Date.now()): FreshnessScore {
  // Recency: full marks if seen in last 24h, decaying to ~0 over 14 days.
  const ageHours = Math.max(0, (now - cluster.lastSeen) / 3_600_000)
  const recency = Math.round(40 * Math.exp(-ageHours / (24 * 5))) // half-life ~3.5d

  // Velocity: cluster growth → trend score (already recency-weighted).
  const velocity = Math.min(35, Math.round(cluster.trendScore * 7))

  // Severity weight.
  const severity = SEVERITY_RANK[cluster.severity] * 6 // up to 24

  const score = Math.min(100, recency + velocity + severity)
  return { score, recency, velocity, severity }
}

/** Rank clusters by freshness (desc). Generic so extra fields are preserved. */
export function rankByFreshness<T extends ScamCluster>(clusters: T[], now = Date.now()): Array<T & { freshness: FreshnessScore }> {
  return clusters
    .map((c) => ({ ...c, freshness: freshnessScore(c, now) }))
    .sort((a, b) => b.freshness.score - a.freshness.score)
}
