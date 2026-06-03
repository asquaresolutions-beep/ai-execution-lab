// ─────────────────────────────────────────────────────────────────
// lib/ai/budget.ts
// Vertex daily-spend circuit breaker. Protects against runaway cost: once
// the estimated day's AI spend crosses DAILY_BUDGET_USD, live generation
// is refused (callers degrade gracefully — autopilot simply stops). Reads
// the cheap per-day usage counters (no scans).
// ─────────────────────────────────────────────────────────────────

import { costToday } from './usage'
import { log } from '@/lib/observability/logger'

const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD) || 5

export interface BudgetStatus {
  spentUsd: number
  capUsd: number
  remainingUsd: number
  withinBudget: boolean
  utilization: number
}

export async function budgetStatus(): Promise<BudgetStatus> {
  const { totalUsd } = await costToday()
  const remainingUsd = Math.max(0, DAILY_BUDGET_USD - totalUsd)
  return {
    spentUsd: totalUsd,
    capUsd: DAILY_BUDGET_USD,
    remainingUsd,
    withinBudget: totalUsd < DAILY_BUDGET_USD,
    utilization: +(totalUsd / DAILY_BUDGET_USD).toFixed(3),
  }
}

export class BudgetExceededError extends Error {
  status = 429
  constructor(cap: number) {
    super(`Daily AI budget ($${cap}) reached — generation paused until tomorrow.`)
    this.name = 'BudgetExceededError'
  }
}

/** Throw if the day's budget is exhausted. Callers should catch + degrade. */
export async function assertWithinBudget(): Promise<void> {
  const s = await budgetStatus()
  if (!s.withinBudget) {
    log.warn({ event: 'ai.budget_exceeded', spentUsd: s.spentUsd, capUsd: s.capUsd })
    throw new BudgetExceededError(s.capUsd)
  }
}
