// ─────────────────────────────────────────────────────────────────
// lib/ai/usage.ts
// Token usage tracking, cost estimation, and Vertex quota monitoring.
//
// - recordUsage() is called after every live generation/embedding with the
//   token counts Vertex returns in usageMetadata.
// - Cost is estimated from a per-model pricing table (USD / 1M tokens).
//   PRICES ARE ESTIMATES — override via env or update PRICING as Google's
//   pricing changes. Confirm against cloud.google.com/vertex-ai/pricing.
// - Daily token counters are kept in the store (cheap increments) so the
//   analytics dashboard and quota monitor can read aggregates without scans.
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'
import { log } from '@/lib/observability/logger'

export type ModelTier = 'flash' | 'pro'

export interface TokenUsage {
  promptTokens: number
  outputTokens: number
  totalTokens: number
}

// USD per 1,000,000 tokens. Estimates — see header.
export interface ModelPrice { inPerM: number; outPerM: number }
export const PRICING: Record<string, ModelPrice> = {
  flash: {
    inPerM: num('VERTEX_FLASH_IN_PER_M', 0.30),
    outPerM: num('VERTEX_FLASH_OUT_PER_M', 2.50),
  },
  pro: {
    inPerM: num('VERTEX_PRO_IN_PER_M', 1.25),
    outPerM: num('VERTEX_PRO_OUT_PER_M', 10.0),
  },
  embedding: {
    inPerM: num('VERTEX_EMBED_IN_PER_M', 0.025),
    outPerM: 0,
  },
}

export function estimateCost(model: keyof typeof PRICING | string, usage: TokenUsage): number {
  const p = PRICING[model] ?? PRICING.flash
  const cost = (usage.promptTokens / 1e6) * p.inPerM + (usage.outputTokens / 1e6) * p.outPerM
  return +cost.toFixed(6)
}

const USAGE_DAILY = '_ai_usage_daily'   // counters per day+model (increments only)
const QUOTA = '_ai_quota'               // per-minute token counters for quota monitor

function dayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10) // YYYY-MM-DD
}

/** Record a completed live call. Best-effort; never throws into the caller. */
export async function recordUsage(
  model: string,
  tier: ModelTier | 'embedding',
  usage: TokenUsage,
): Promise<{ costUsd: number }> {
  const costUsd = estimateCost(tier, usage)
  // Structured cost-estimation log line (picked up by log drains).
  log.info({
    event: 'ai.usage',
    model,
    tier,
    promptTokens: usage.promptTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    estCostUsd: costUsd,
  })
  try {
    const store = getStore()
    const id = `${dayKey()}__${tier}`
    await store.increment(USAGE_DAILY, id, 'promptTokens', usage.promptTokens)
    await store.increment(USAGE_DAILY, id, 'outputTokens', usage.outputTokens)
    await store.increment(USAGE_DAILY, id, 'totalTokens', usage.totalTokens)
    await store.increment(USAGE_DAILY, id, 'calls', 1)
    // microUSD avoids float drift in counters.
    await store.increment(USAGE_DAILY, id, 'microUsd', Math.round(costUsd * 1e6))
    await store.update(USAGE_DAILY, id, { day: dayKey(), tier, model })

    // Quota monitor: tokens this minute.
    const minute = Math.floor(Date.now() / 60_000)
    await store.increment(QUOTA, `${tier}__${minute}`, 'tokens', usage.totalTokens)
  } catch {
    /* counters are observability, not correctness */
  }
  return { costUsd }
}

export interface DailyUsage {
  day: string
  tier: string
  model?: string
  calls: number
  promptTokens: number
  outputTokens: number
  totalTokens: number
  estCostUsd: number
}

export async function usageForDay(day = dayKey()): Promise<DailyUsage[]> {
  const rows = await getStore().query<Record<string, unknown>>(USAGE_DAILY, {
    where: [{ field: 'day', op: '==', value: day }],
    limit: 50,
  })
  return rows.map((r) => {
    const d = r.data
    return {
      day,
      tier: String(d.tier ?? ''),
      model: d.model as string | undefined,
      calls: (d.calls as number) ?? 0,
      promptTokens: (d.promptTokens as number) ?? 0,
      outputTokens: (d.outputTokens as number) ?? 0,
      totalTokens: (d.totalTokens as number) ?? 0,
      estCostUsd: +(((d.microUsd as number) ?? 0) / 1e6).toFixed(4),
    }
  })
}

export async function costToday(): Promise<{ totalUsd: number; byTier: Record<string, number> }> {
  const rows = await usageForDay()
  const byTier: Record<string, number> = {}
  let totalUsd = 0
  for (const r of rows) {
    byTier[r.tier] = (byTier[r.tier] ?? 0) + r.estCostUsd
    totalUsd += r.estCostUsd
  }
  return { totalUsd: +totalUsd.toFixed(4), byTier }
}

// ── Quota monitoring ───────────────────────────────────────────────
// Vertex enforces per-minute token quotas. We track tokens/min so the
// system can pre-emptively back off before hitting hard 429s.
export const QUOTA_TOKENS_PER_MIN = num('VERTEX_TOKENS_PER_MIN', 100_000)

export interface QuotaStatus {
  tier: ModelTier
  windowTokens: number
  limit: number
  utilization: number   // 0..1
  nearLimit: boolean
}

export async function quotaStatus(tier: ModelTier): Promise<QuotaStatus> {
  const minute = Math.floor(Date.now() / 60_000)
  const doc = await getStore().get<{ tokens?: number }>(QUOTA, `${tier}__${minute}`)
  const windowTokens = doc?.data.tokens ?? 0
  const utilization = windowTokens / QUOTA_TOKENS_PER_MIN
  return { tier, windowTokens, limit: QUOTA_TOKENS_PER_MIN, utilization, nearLimit: utilization >= 0.85 }
}

function num(key: string, fallback: number): number {
  const v = Number(process.env[key])
  return Number.isFinite(v) && v > 0 ? v : fallback
}
