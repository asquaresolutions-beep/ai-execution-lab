// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/prompts.ts
// Reusable prompts for classification + moderation. Structured JSON out.
// ─────────────────────────────────────────────────────────────────

export const SCAM_INTEL_PROMPT_VERSION = '2026-05-30.1'

export const CATEGORIES = [
  'phishing', 'otp_fraud', 'whatsapp_scam', 'fake_job', 'investment_fraud',
  'upi_fraud', 'loan_scam', 'lottery_prize', 'tech_support', 'romance',
  'courier_customs', 'other',
] as const

export const CLASSIFY_SYSTEM = `You are a scam-intelligence analyst for a public safety platform.
You read user-submitted scam reports and classify them precisely and neutrally.
Never include any personal data of victims or third parties in your output.
Be conservative with confidence. Output ONLY the requested JSON.`

export function classifyPrompt(text: string, platformHint?: string, regionHint?: string): string {
  return `REPORT TEXT:
"""${text.slice(0, 4000)}"""
${platformHint ? `\nReporter platform hint: ${platformHint}` : ''}${regionHint ? `\nReporter region hint: ${regionHint}` : ''}

Classify this scam report. Return STRICT JSON:
{
  "category": one of ${JSON.stringify(CATEGORIES)},
  "confidence": 0.0-1.0,
  "platform": "best-guess platform (WhatsApp, UPI, Email, SMS, Telegram, phone call, website, unknown)",
  "region": "best-guess region or 'unknown'",
  "tactics": ["social-engineering tactics used"],
  "indicators": ["observable signals: suspicious url shape, phone pattern, brand impersonated, amount, etc. — DO NOT include real victim PII"],
  "summary": "one neutral sentence describing the scam pattern"
}`
}

export const MODERATION_SYSTEM = `You are a content moderation classifier. You assess user-submitted text for
public display safety. Output ONLY JSON.`

export function moderationPrompt(text: string): string {
  return `TEXT:
"""${text.slice(0, 4000)}"""

Assess for public display on a scam-alert feed. Return STRICT JSON:
{
  "verdict": "allow" | "review" | "block",
  "toxic": true/false,          // hate, harassment, explicit content
  "containsPII": true/false,    // phone, email, account numbers, names of private individuals
  "reasons": ["short reasons"]
}
Block if it is abusive, doxxing, or clearly not a scam report. Use "review" when uncertain.`
}
