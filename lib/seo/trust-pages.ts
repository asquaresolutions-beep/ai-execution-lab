// ─────────────────────────────────────────────────────────────────
// lib/seo/trust-pages.ts
// Content for the E-E-A-T trust layer: editorial policy, AI disclosure,
// methodology, transparency, and author/about pages. Static, deterministic.
// Strong trust signals improve ranking, AI-Overview citation odds, and
// Google Discover eligibility ("Who/Why/How" + clear authorship).
// ─────────────────────────────────────────────────────────────────

export interface TrustPage {
  slug: string
  title: string
  description: string
  updated: string
  sections: { heading: string; body: string[] }[]
}

const ORG = 'A Square Solutions'
const UPDATED = '2026-05-30'

export const TRUST_PAGES: TrustPage[] = [
  {
    slug: 'editorial-policy',
    title: 'Editorial Policy',
    description: 'How ScamCheck researches, writes, reviews, and corrects its scam-awareness content.',
    updated: UPDATED,
    sections: [
      { heading: 'Our mission', body: ['ScamCheck publishes accurate, actionable scam-awareness information to help people in India and worldwide avoid fraud. Public safety comes before traffic or revenue.'] },
      { heading: 'Sourcing & accuracy', body: ['We orient guidance around official authorities — the cyber-fraud helpline 1930, cybercrime.gov.in, RBI, and SEBI.', 'We do not fabricate statistics, case numbers, or authorities. Where a figure is uncertain, we omit it.'] },
      { heading: 'Review & corrections', body: ['Content is reviewed for accuracy and safety before publishing via an automated quality gate plus human oversight on flagged items.', 'Spotted an error? Contact us and we will correct it promptly. Pages show a clear "last updated" date.'] },
      { heading: 'Independence', body: ['Advertising and any paid plans never influence our scam assessments or which scams we cover.'] },
    ],
  },
  {
    slug: 'ai-disclosure',
    title: 'AI Disclosure',
    description: 'How ScamCheck uses AI to detect, classify, and explain scams — and the human safeguards around it.',
    updated: UPDATED,
    sections: [
      { heading: 'How we use AI', body: ['ScamCheck uses Google Vertex AI (Gemini) to classify scam reports, cluster similar patterns, and draft plain-language explanations in English and Hindi.', 'AI assists research and drafting; it does not replace our editorial and safety standards.'] },
      { heading: 'Safeguards', body: ['Every AI-assisted page passes a deterministic quality gate before publishing (no thin or placeholder content).', 'We redact personal data, block abusive content, and never publish instructions that could help a scammer.', 'Rule-based detectors provide a verified fallback when AI is unavailable.'] },
      { heading: 'Limitations', body: ['AI can make mistakes. Treat our guidance as awareness, not legal or financial advice, and report fraud to official channels (1930 / cybercrime.gov.in).'] },
    ],
  },
  {
    slug: 'methodology',
    title: 'Methodology',
    description: 'How ScamCheck collects scam reports, scores severity and trends, and decides what to publish.',
    updated: UPDATED,
    sections: [
      { heading: 'Data collection', body: ['We ingest public scam reports through a lightweight, rate-limited submission pipeline with spam and abuse filtering.', 'Personal data is redacted on intake; we never store raw contact details.'] },
      { heading: 'Deduplication & clustering', body: ['Reports are converted to embeddings and clustered by semantic similarity, so thousands of near-identical scams collapse into one canonical pattern.'] },
      { heading: 'Severity & trend scoring', body: ['Severity is an explainable 0–100 score (category risk, indicators, spread, velocity).', 'Trending uses a recency-weighted score; "viral" and "active" flags reflect momentum and the last-reported window.'] },
      { heading: 'Publishing thresholds', body: ['Pages are auto-generated for genuinely trending patterns, deduplicated to one per pattern, and only published if they pass quality and budget gates.'] },
    ],
  },
  {
    slug: 'transparency',
    title: 'Transparency Report',
    description: 'What ScamCheck publishes, how it is funded, and how we handle data and moderation.',
    updated: UPDATED,
    sections: [
      { heading: 'Funding', body: ['ScamCheck is supported by non-intrusive advertising and optional paid plans. Free users see limited ads; paid users see none.'] },
      { heading: 'Data & privacy', body: ['We store de-identified scam patterns, not personal data. Submission identities are hashed for abuse prevention only.'] },
      { heading: 'Moderation', body: ['User submissions pass automated spam/abuse and AI moderation, with a human review queue for uncertain cases. Abusive or doxxing content is blocked.'] },
    ],
  },
  {
    slug: 'about',
    title: 'About ScamCheck & the Team',
    description: 'Who is behind ScamCheck — A Square Solutions — and why we built it.',
    updated: UPDATED,
    sections: [
      { heading: 'Who we are', body: [`ScamCheck is built and operated by ${ORG}, an India-based AI and digital-products company.`, 'We combine AI scam intelligence with clear, bilingual public-safety guidance.'] },
      { heading: 'Why we built it', body: ['Online fraud in India is rising and moves faster than traditional awareness content. ScamCheck is designed to detect and explain new scams in near-real time.'] },
      { heading: 'Contact', body: ['Report fraud to the national helpline 1930 or cybercrime.gov.in. For corrections or partnership/embed enquiries, contact A Square Solutions.'] },
    ],
  },
]

export const TRUST_PAGE_BY_SLUG = new Map(TRUST_PAGES.map((p) => [p.slug, p]))
export function trustPageSlugs(): string[] { return TRUST_PAGES.map((p) => p.slug) }
