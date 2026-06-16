// ─────────────────────────────────────────────────────────────────
// lib/trustseal/certificate.ts  (asq-trustseal-phase3)
// SERVER-ONLY: assembles a verification certificate from public seal data.
// Deterministic Certificate ID + a tamper-evident SHA-256 fingerprint over the
// canonical cert payload (anyone can recompute and compare), plus an optional
// HMAC signature (tamper-PROOF) when TRUSTSEAL_SEAL_SECRET is set. No outbound
// calls — pure crypto over data the caller already has.
// ─────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'
import type { SealData } from './seal'
import { signSeal } from './seal-sign'
import { bandMeta } from './band'
import { qrEncode, qrSvg } from './qr'

const TRUST_BASE = (process.env.TRUSTSEAL_BASE_URL || 'https://trustseal.asquaresolution.com').replace(/\/$/, '')

// Reverification cadence: a clean verdict is re-checked within ~90 days.
const REVERIFY_DAYS = 90

export interface Certificate {
  domain: string
  certId: string
  trustLevel: string // English band name (Verified/Established/…)
  band: string
  score: number | null
  verifiedAt: number
  issuedAt: number
  reverifyDue: number
  verifyUrl: string
  /** Public, recomputable fingerprint of the canonical payload (tamper-evident). */
  fingerprint: string
  /** HMAC signature (tamper-proof) or null when no secret configured. */
  signature: string | null
  /** Inline SVG QR of the verification URL, or null if it doesn't fit. */
  qrSvg: string | null
}

function group(hex: string): string {
  return (hex.slice(0, 12).toUpperCase().match(/.{1,4}/g) || []).join('-')
}

/** Stable Certificate ID for a (domain, verifiedAt) pair: TS-XXXX-XXXX-XXXX. */
export function certificateId(domain: string, verifiedAt: number): string {
  const h = createHash('sha256').update(`${domain}|${verifiedAt}`).digest('hex')
  return `TS-${group(h)}`
}

export function buildCertificate(data: SealData): Certificate {
  const certId = certificateId(data.domain, data.verifiedAt)
  const band = data.report?.band ?? 'verified'
  const score = data.report?.score ?? null
  const issuedAt = Date.now()
  const reverifyDue = (data.lastCheckedAt ?? data.verifiedAt) + REVERIFY_DAYS * 86_400_000
  const verifyUrl = `${TRUST_BASE}/en/trust/${data.domain}`

  // Canonical payload — the exact string the fingerprint/signature commit to.
  const canonical = `TrustSeal-Certificate|v1|${certId}|${data.domain}|${band}|${score ?? ''}|${data.verifiedAt}`
  const fingerprint = createHash('sha256').update(canonical).digest('hex')
  const signature = signSeal({ domain: data.domain, status: `cert:${certId}:${band}`, issuedAt: data.verifiedAt })

  const qr = qrEncode(verifyUrl)

  return {
    domain: data.domain,
    certId,
    trustLevel: bandMeta(band).name,
    band,
    score,
    verifiedAt: data.verifiedAt,
    issuedAt,
    reverifyDue,
    verifyUrl,
    fingerprint,
    signature,
    qrSvg: qr ? qrSvg(qr, { size: 150 }) : null,
  }
}
