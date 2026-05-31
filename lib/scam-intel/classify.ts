// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/classify.ts
// AI classification with a deterministic rule-based detector layer.
//
// The detector layer runs FIRST (free, instant, offline) and provides:
//   - a strong category prior + indicators (phishing, OTP, fake job,
//     investment, WhatsApp clustering signal)
//   - a fallback classification when AI is unavailable
// The AI pass refines/overrides low-confidence rule output.
// ─────────────────────────────────────────────────────────────────

import { generateJSON } from '@/lib/ai/provider'
import { cached } from '@/lib/ai/cache'
import { classifyPrompt, CLASSIFY_SYSTEM, SCAM_INTEL_PROMPT_VERSION } from './prompts'
import type { Classification, ScamCategory } from './types'

// ── Rule-based detectors (signal extraction) ───────────────────────
interface DetectorHit { category: ScamCategory; weight: number; indicators: string[]; tactics: string[] }

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+/gi
const SHORTENER_RE = /\b(bit\.ly|tinyurl|t\.co|cutt\.ly|rb\.gy|is\.gd|shorturl|rebrand\.ly)\b/i
const PHONE_RE = /(?:\+?\d[\d\s-]{7,}\d)/g
const MONEY_RE = /(?:₹|rs\.?|inr|usd|\$)\s?[\d,]+(?:\.\d+)?|\b\d+\s?(?:lakh|crore|k)\b/gi
const OTP_RE = /\b(otp|one[\s-]?time\s?password|verification code|cvv|pin)\b/i
const KYC_RE = /\b(kyc|re-?kyc|update.{0,12}(aadhaar|pan|account)|account.{0,8}(block|suspend|frozen))\b/i
const JOB_RE = /\b(work from home|part[\s-]?time job|earn .{0,15}(daily|per day)|hiring|recruit|registration fee|telegram task)\b/i
const INVEST_RE = /\b(guaranteed returns?|double your money|crypto|trading (signal|tips)|stock tip|investment plan|profit \d+%)\b/i
const PRIZE_RE = /\b(you (have )?won|lottery|lucky draw|prize|gift|reward claim)\b/i
const LOAN_RE = /\b(instant loan|pre-?approved loan|loan approv|low interest loan)\b/i
const IMPERSONATE_RE = /\b(bank|amazon|flipkart|paytm|phonepe|government|police|customs|courier|fedex|dhl|income tax|electricity)\b/i

function runDetectors(text: string): DetectorHit[] {
  const t = text.toLowerCase()
  const urls = text.match(URL_RE) ?? []
  const hits: DetectorHit[] = []
  const ind: string[] = []
  if (urls.length) ind.push(`${urls.length} link(s)`)
  if (SHORTENER_RE.test(text)) ind.push('shortened URL')
  if (PHONE_RE.test(text)) ind.push('phone number present')
  const money = text.match(MONEY_RE) ?? []
  if (money.length) ind.push(`money mentioned (${money[0]})`)

  if (OTP_RE.test(t) || KYC_RE.test(t)) {
    hits.push({ category: 'otp_fraud', weight: 0.8, indicators: [...ind, 'OTP/KYC language'], tactics: ['urgency', 'impersonation'] })
  }
  if ((urls.length && IMPERSONATE_RE.test(t)) || (SHORTENER_RE.test(text) && KYC_RE.test(t))) {
    hits.push({ category: 'phishing', weight: 0.75, indicators: [...ind, 'brand impersonation + link'], tactics: ['impersonation', 'credential harvest'] })
  }
  if (JOB_RE.test(t)) hits.push({ category: 'fake_job', weight: 0.7, indicators: [...ind, 'job/earning offer'], tactics: ['advance fee', 'task scam'] })
  if (INVEST_RE.test(t)) hits.push({ category: 'investment_fraud', weight: 0.7, indicators: [...ind, 'investment/returns claim'], tactics: ['greed', 'fake returns'] })
  if (LOAN_RE.test(t)) hits.push({ category: 'loan_scam', weight: 0.6, indicators: ind, tactics: ['advance fee'] })
  if (PRIZE_RE.test(t)) hits.push({ category: 'lottery_prize', weight: 0.6, indicators: ind, tactics: ['too good to be true'] })
  if (/upi|@(?:ok| y|i)bl|collect request|autopay mandate/i.test(t)) {
    hits.push({ category: 'upi_fraud', weight: 0.65, indicators: [...ind, 'UPI artefact'], tactics: ['collect-request trick'] })
  }
  return hits.sort((a, b) => b.weight - a.weight)
}

/** WhatsApp signal — used by clustering + platform inference. */
export function detectWhatsApp(text: string, platformHint?: string): boolean {
  return /whats\s?app|wa\.me|forwarded many times|group invite/i.test(text) ||
    (platformHint?.toLowerCase().includes('whatsapp') ?? false)
}

export function ruleClassify(text: string, platformHint?: string, regionHint?: string): Classification {
  const hits = runDetectors(text)
  const top = hits[0]
  const isWa = detectWhatsApp(text, platformHint)
  const category: ScamCategory = top?.category ?? (isWa ? 'whatsapp_scam' : 'other')
  return {
    category,
    confidence: top ? Math.min(0.7, top.weight) : 0.25,
    platform: platformHint || (isWa ? 'WhatsApp' : inferPlatform(text)),
    region: regionHint || 'unknown',
    tactics: top?.tactics ?? [],
    indicators: top?.indicators ?? [],
    summary: top ? `Likely ${category.replace(/_/g, ' ')} scam.` : 'Unclassified report.',
  }
}

function inferPlatform(text: string): string {
  const t = text.toLowerCase()
  if (/\bemail|@.+\.(com|in|org)\b/.test(t)) return 'Email'
  if (/\bsms|text message\b/.test(t)) return 'SMS'
  if (/telegram|t\.me/.test(t)) return 'Telegram'
  if (URL_RE.test(text)) return 'website'
  return 'unknown'
}

// ── AI-refined classification ──────────────────────────────────────
export async function classify(
  text: string,
  platformHint?: string,
  regionHint?: string,
): Promise<Classification> {
  const rule = ruleClassify(text, platformHint, regionHint)
  // High-confidence rule hit → trust it, skip AI cost.
  if (rule.confidence >= 0.7) return rule

  try {
    const ai = await cached('scam-classify', { text, platformHint, regionHint, v: SCAM_INTEL_PROMPT_VERSION }, () =>
      generateJSON<Partial<Classification>>(classifyPrompt(text, platformHint, regionHint), {
        system: CLASSIFY_SYSTEM, temperature: 0.2,
      }),
    )
    return {
      category: (ai.category as ScamCategory) || rule.category,
      confidence: typeof ai.confidence === 'number' ? ai.confidence : rule.confidence,
      platform: ai.platform || rule.platform,
      region: ai.region || rule.region,
      tactics: merge(rule.tactics, ai.tactics),
      indicators: merge(rule.indicators, ai.indicators),
      summary: ai.summary || rule.summary,
    }
  } catch {
    return rule // AI unavailable → deterministic fallback.
  }
}

function merge(a: string[] = [], b: string[] = []): string[] {
  return [...new Set([...a, ...b].map((x) => x.trim()).filter(Boolean))]
}
