// ─────────────────────────────────────────────────────────────────
// lib/seo/authority.ts
// Trust signals: official government/cybercrime references, citations,
// and a transparent trust score. Boosts E-E-A-T, AI-Overview citation
// likelihood, and user trust. All references are real and India-first.
// ─────────────────────────────────────────────────────────────────

export interface Reference {
  label: string
  url: string
  kind: 'helpline' | 'portal' | 'regulator' | 'guideline'
  note: string
}

// Authoritative Indian sources — cited on every programmatic page.
export const OFFICIAL_REFERENCES: Reference[] = [
  { label: 'Cyber Crime Helpline 1930', url: 'tel:1930', kind: 'helpline',
    note: 'National cyber-fraud financial helpline — call within the "golden hour" to freeze fraudulent transfers.' },
  { label: 'National Cyber Crime Reporting Portal', url: 'https://cybercrime.gov.in', kind: 'portal',
    note: 'Official Government of India portal to report financial and other cybercrimes.' },
  { label: 'RBI Sachet', url: 'https://sachet.rbi.org.in', kind: 'regulator',
    note: 'Reserve Bank of India portal to report unauthorised entities and lending apps.' },
  { label: 'RBI — BEWARE of fictitious offers', url: 'https://www.rbi.org.in', kind: 'regulator',
    note: 'RBI guidance on financial fraud awareness.' },
  { label: 'SEBI Investor Charter', url: 'https://www.sebi.gov.in', kind: 'regulator',
    note: 'Verify registered investment advisors and report securities fraud.' },
  { label: 'DoT Sanchar Saathi (Chakshu)', url: 'https://sancharsaathi.gov.in', kind: 'portal',
    note: 'Report suspected fraud communication (calls/SMS) and block lost/stolen mobiles.' },
]

export const HELPLINE_1930 = OFFICIAL_REFERENCES[0]
export const CYBERCRIME_PORTAL = OFFICIAL_REFERENCES[1]

/** References most relevant to a given scam type. */
export function referencesForType(typeId: string): Reference[] {
  const base = [HELPLINE_1930, CYBERCRIME_PORTAL]
  if (/investment|stock|crypto/.test(typeId)) base.push(OFFICIAL_REFERENCES[4])
  if (/loan/.test(typeId)) base.push(OFFICIAL_REFERENCES[2])
  if (/phishing|otp|kyc|upi/.test(typeId)) base.push(OFFICIAL_REFERENCES[5])
  return base
}

// ── Trust scoring ──────────────────────────────────────────────────
// A transparent 0–100 page trust score signalling content completeness +
// citation strength. Shown as a badge and fed into structured data.
export interface TrustInput {
  hasOfficialRefs: boolean
  citationCount: number
  hasHelpline: boolean
  hasLastUpdated: boolean
  factCount: number
  bilingual: boolean
}

export interface TrustScore { score: number; band: 'standard' | 'verified' | 'authoritative'; factors: Record<string, number> }

export function trustScore(input: TrustInput): TrustScore {
  const factors: Record<string, number> = {
    officialRefs: input.hasOfficialRefs ? 25 : 0,
    citations: Math.min(20, input.citationCount * 5),
    helpline: input.hasHelpline ? 15 : 0,
    freshness: input.hasLastUpdated ? 15 : 0,
    facts: Math.min(15, input.factCount * 2),
    bilingual: input.bilingual ? 10 : 0,
  }
  const score = Math.min(100, Object.values(factors).reduce((a, b) => a + b, 0))
  const band = score >= 85 ? 'authoritative' : score >= 60 ? 'verified' : 'standard'
  return { score, band, factors }
}
