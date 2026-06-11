// ─────────────────────────────────────────────────────────────────
// lib/trustseal/verify/types.ts  (asq-trustseal-c1b)
// Verify-engine types. Frozen per TRUSTSEAL_C1A_VERIFY_SCHEMA_V2. Pure (no runtime
// imports) so the scoring/normalize/verify modules that consume it stay
// node --experimental-strip-types testable.
// ─────────────────────────────────────────────────────────────────

export type SignalCategory = 'reputation' | 'legitimacy' | 'dns' | 'ssl' | 'whois' | 'web' | 'impersonation'

// not_applicable = legit absence (neutral, no penalty); missing = expected-but-absent
// (no penalty, no coverage); blocked/error/timeout = opacity/failure (penalty on hard cats).
export type SignalStatus = 'ok' | 'not_applicable' | 'missing' | 'blocked' | 'error' | 'timeout'

export type VerifyBand = 'verified' | 'established' | 'limited' | 'caution' | 'high_risk'
export type VerifyTier = 'mvp' | 'phase2' | 'enterprise'

export interface Signal {
  id: string                  // 'dns.mx', 'ssl.validation_level', 'blocklist.safe_browsing'
  category: SignalCategory
  status: SignalStatus
  score: number               // 0–100 contribution when status==='ok'
  value?: string | number | boolean
  evidence?: string           // short proof (capped length)
  /** Marks this signal as a fraud trigger when true (→ score cap). */
  cap?: 'blocklist' | 'impersonation' | 'intel_graph' | 'unreachable'
  source: string
  observedAt: number
}

export interface CategoryScore {
  category: SignalCategory
  weight: number
  subScore: number
  covered: boolean            // ≥1 ok signal in this category
  signalCount: number
}

export interface FraudCap { rule: string; cappedAt: number; firedBy: string }

export interface ScoreOutput {
  score: number               // final, post-cap, 0–100
  baseScore: number           // pre-cap
  band: VerifyBand
  confidence: number          // 0–1, category-coverage × freshness
  categories: CategoryScore[]
  caps: FraudCap[]
  badges: string[]
  opacity: boolean            // ≥2 hard categories blocked/hidden
}

export interface VerifyResult extends ScoreOutput {
  id: string                  // vs_<sha1(canonical)>
  domain: string              // canonical (eTLD+1)
  inputDomain: string
  inputName?: string
  country?: string
  signals: Signal[]
  tier: VerifyTier
  partial: boolean            // any collector errored/timed out
  checkedAt: number
  ttlSeconds: number
  signalSchemaVersion: string
  weightsVersion: string
}

// ── Collector contract ──────────────────────────────────────────
export interface CollectorContext {
  domain: string              // canonical
  inputName?: string
  country?: string
  tier: VerifyTier
  now: number
  signal: AbortSignal         // honor for timeout/cancellation
}
export interface CollectorOutput { signals: Signal[]; ms: number; error?: string }
export interface Collector {
  id: string
  tier: VerifyTier
  timeoutMs: number
  collect(ctx: CollectorContext): Promise<CollectorOutput>
}
