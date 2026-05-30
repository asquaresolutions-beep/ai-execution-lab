// ─────────────────────────────────────────────────────────────────
// lib/seo/programmatic.ts
// The programmatic page generator. Given a dimension + value (and optional
// scam type), it assembles a complete, AI-Overview-optimized, bilingual,
// internally-linked, schema-rich PageModel — deterministically (no AI).
//
// AI Overview / featured-snippet optimization is structural:
//   directAnswer (lead) → verdict snippet → quick bullets → FAQ-first →
//   structured summary → authority citations.
// ─────────────────────────────────────────────────────────────────

import {
  SCAM_TYPES, SCAM_TYPE_BY_ID, facetById, slug,
  type ScamType, type Dimension, type Facet,
} from './facets'
import { referencesForType, trustScore, type Reference, type TrustScore } from './authority'
import { buildDiscoverMeta, type DiscoverMeta } from './discover'

// Canonical base = where these SSG pages are actually served. Defaults to
// the lab site; set NEXT_PUBLIC_SCAM_BASE_URL to serve from a dedicated
// scam subdomain mapped to the same Vercel project.
const BASE = (process.env.NEXT_PUBLIC_SCAM_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://lab.asquaresolution.com').replace(/\/$/, '')
const BRAND = 'ScamCheck'
const UPDATED_AT = Date.parse(process.env.SCAM_CONTENT_DATE || '') || Date.now()

export interface FaqItem { question: string; answer: string }
export interface QuickBullet { text: string }
export interface InternalLink { anchor: string; href: string; group: 'related-scams' | 'related-alerts' | 'trending' | 'latest' | 'facet' }
export interface LocalizedFields { directAnswer: string; verdict: string; h1: string }

export interface PageModel {
  kind: 'hub' | 'type' | 'facet' | 'combo'
  path: string
  canonical: string
  title: string                 // <title>
  metaDescription: string
  h1: string
  directAnswer: string          // ≤ 320 chars, leads the page (AI Overview)
  verdict: string               // one-line "verdict snippet"
  riskLevel: 'High' | 'Medium'  // severity label for CTR badge
  quickBullets: string[]        // scannable summary
  structuredSummary: { label: string; value: string }[]
  sections: { heading: string; body: string[] }[]
  faq: FaqItem[]                // FAQ-first
  references: Reference[]
  internalLinks: InternalLink[]
  breadcrumb: { name: string; href: string }[]
  trust: TrustScore
  discover: DiscoverMeta
  hi: LocalizedFields           // Hindi key fields (GEO)
  updatedAt: number
  schema: object[]              // JSON-LD: Article + FAQPage + Breadcrumb
}

// ── Builders ───────────────────────────────────────────────────────
export function buildTypePage(typeId: string): PageModel | null {
  const t = SCAM_TYPE_BY_ID.get(typeId)
  if (!t) return null
  return assemble({ kind: 'type', t, path: `/scams/type/${t.id}` })
}

export function buildFacetPage(dim: Exclude<Dimension, 'type'>, facetId: string): PageModel | null {
  const f = facetById(dim, facetId)
  if (!f) return null
  return assemble({ kind: 'facet', facet: f, dim, path: `/scams/${dim}/${f.id}` })
}

export function buildComboPage(typeId: string, cityId: string): PageModel | null {
  const t = SCAM_TYPE_BY_ID.get(typeId)
  const f = facetById('city', cityId)
  if (!t || !f) return null
  return assemble({ kind: 'combo', t, facet: f, dim: 'city', path: `/scams/type/${t.id}/${f.id}` })
}

interface AssembleArgs {
  kind: PageModel['kind']
  t?: ScamType
  facet?: Facet
  dim?: Dimension
  path: string
}

function assemble(a: AssembleArgs): PageModel {
  const { t, facet, dim, path } = a
  const place = facet ? facet.name : ''
  const subject = subjectLine(t, facet, dim)
  const titleSubject = t ? t.name : facetTopic(facet!, dim!)

  // ── Direct answer (leads the page; optimized for AI Overviews) ──
  const directAnswer = t
    ? `A ${t.name.toLowerCase()}${place ? ` reported ${dim === 'city' ? 'in' : 'via'} ${place}` : ''} is when ${lower(t.hook)} Never share your OTP, UPI PIN, or card details, and report fraud to 1930 or cybercrime.gov.in.`
    : `Scammers commonly target ${place} users. Verify any message before acting, never share OTPs or your UPI PIN, and report fraud to 1930 or cybercrime.gov.in.`

  const verdict = t
    ? `Verdict: If it pressures you to act fast, asks for an OTP/PIN, or sends an unexpected link — treat it as a likely ${t.name.toLowerCase()}.`
    : `Verdict: Unexpected + urgent + asks for money or codes = likely scam. Pause and verify.`

  const quickBullets = t
    ? [`How it works: ${t.hook}`, ...t.signs.slice(0, 3).map((s) => `Warning sign: ${s}`), `Do this: ${t.protect[0]}`]
    : [
        `Most-reported scams${place ? ` for ${place}` : ''}: UPI fraud, OTP fraud, KYC fraud, phishing.`,
        'Warning sign: urgency + a request for OTP/PIN or an unexpected link.',
        'Do this: verify in the official app, never via links.',
        'Report financial fraud to 1930 within the golden hour.',
      ]

  const references = t ? referencesForType(t.id) : referencesForType('upi-fraud')

  const faq = buildFaq(t, facet, dim)
  const sections = buildSections(t, facet, dim, place)
  const internalLinks = buildInternalLinks(t, facet, dim)

  const trust = trustScore({
    hasOfficialRefs: true,
    citationCount: references.length,
    hasHelpline: true,
    hasLastUpdated: true,
    factCount: quickBullets.length,
    bilingual: true,
  })

  const discover = buildDiscoverMeta({ subject, typeName: titleSubject, region: dim === 'city' ? place : undefined, updatedAt: UPDATED_AT })

  const title = clip(t
    ? `${t.name}${place ? ` ${dim === 'city' ? 'in' : 'on'} ${place}` : ''} — Warning Signs & How to Stay Safe | ${BRAND}`
    : `${facetTopic(facet!, dim!)} Scams — Spot, Avoid & Report | ${BRAND}`, 70)

  const metaDescription = clip(`${directAnswer}`, 158)

  const breadcrumb = buildBreadcrumb(a)
  const canonical = `${BASE}${path}`

  const hi: LocalizedFields = {
    h1: t ? `${t.nameHi}${place ? ` — ${place}` : ''}: कैसे पहचानें और बचें` : `${place} स्कैम: कैसे बचें`,
    directAnswer: t
      ? `${t.nameHi} में ${lower(t.hook)} कभी भी OTP, UPI पिन या कार्ड डिटेल साझा न करें। धोखाधड़ी की रिपोर्ट 1930 या cybercrime.gov.in पर करें।`
      : `किसी भी मैसेज पर भरोसा करने से पहले जांचें। OTP या UPI पिन कभी साझा न करें। धोखाधड़ी की रिपोर्ट 1930 पर करें।`,
    verdict: t
      ? `नतीजा: अगर कोई जल्दबाज़ी कराए, OTP/पिन मांगे या अनचाहा लिंक भेजे — तो इसे ${t.nameHi} समझें।`
      : `नतीजा: अनचाहा + जल्दबाज़ी + पैसे/कोड की मांग = संभावित स्कैम।`,
  }

  const h1 = t
    ? `${t.name}${place ? ` ${dim === 'city' ? 'in' : 'on'} ${place}` : ''}: How It Works & How to Stay Safe`
    : `${facetTopic(facet!, dim!)} Scams: How to Spot, Avoid & Report`

  const schema = buildSchema({ title, metaDescription, canonical, h1, faq, breadcrumb, updatedAt: UPDATED_AT })

  return {
    kind: a.kind, path, canonical, title, metaDescription, h1,
    directAnswer, verdict,
    riskLevel: t && t.searchVolumeTier === 1 ? 'High' : 'Medium',
    quickBullets,
    structuredSummary: buildStructuredSummary(t, facet, dim),
    sections, faq, references, internalLinks, breadcrumb, trust, discover, hi,
    updatedAt: UPDATED_AT, schema,
  }
}

// ── Sub-builders ───────────────────────────────────────────────────
function buildFaq(t?: ScamType, facet?: Facet, dim?: Dimension): FaqItem[] {
  const place = facet?.name ?? ''
  if (t) {
    return [
      { question: `What is a ${t.name.toLowerCase()}?`, answer: `${t.hook} ${t.aka.length ? `It is also known as ${t.aka.join(', ')}.` : ''}` },
      { question: `How do I know if it's a ${t.name.toLowerCase()}?`, answer: `Watch for: ${t.signs.join('; ')}.` },
      { question: `How can I protect myself?`, answer: `${t.protect.join('. ')}.` },
      { question: `What should I do if I'm targeted${place ? ` in ${place}` : ''}?`, answer: `Do not pay or share any codes. Call 1930 immediately and file a report at cybercrime.gov.in. The faster you report, the higher the chance of recovering money.` },
      { question: `Is sharing an OTP ever safe?`, answer: `No. No bank, wallet, or company will ever ask for your OTP, UPI PIN, or CVV. Anyone who does is a scammer.` },
    ]
  }
  const topic = facetTopic(facet!, dim!)
  return [
    { question: `What scams target ${topic} users?`, answer: `The most common are UPI fraud, OTP fraud, KYC-update fraud, and phishing links impersonating ${topic}.` },
    { question: `How do I verify a ${topic} message?`, answer: `Open the official ${dim === 'bank' || dim === 'upi' ? 'app' : 'website/app'} yourself instead of tapping links, and confirm via official customer care.` },
    { question: `Where do I report ${topic} fraud?`, answer: `Call 1930 and file a complaint at cybercrime.gov.in. For lending/payment entities you can also use RBI Sachet (sachet.rbi.org.in).` },
  ]
}

function buildSections(t: ScamType | undefined, facet: Facet | undefined, dim: Dimension | undefined, place: string): { heading: string; body: string[] }[] {
  if (t) {
    return [
      { heading: `How the ${t.name.toLowerCase()} works`, body: [t.hook, place ? `Reports involving ${place} follow the same pattern; the brand or location only changes the disguise.` : 'The disguise changes, but the goal is always your money or your codes.'] },
      { heading: 'Warning signs', body: t.signs },
      { heading: 'How to protect yourself', body: t.protect },
      { heading: 'What to do if you are targeted', body: ['Stop — do not pay or share any OTP/PIN.', 'Call the cyber-fraud helpline 1930 within the golden hour.', 'File a report at cybercrime.gov.in with screenshots and transaction details.', 'Inform your bank to freeze/raise a dispute on the transaction.'] },
    ]
  }
  const topic = facetTopic(facet!, dim!)
  return [
    { heading: `Common scams targeting ${topic}`, body: SCAM_TYPES.filter((s) => s.searchVolumeTier === 1).map((s) => `${s.name}: ${s.hook}`) },
    { heading: `How to stay safe with ${topic}`, body: ['Always open the official app/website directly — never via links in messages.', 'Never share OTP, UPI PIN, or card details with anyone.', 'Enable 2-factor authentication and transaction alerts.'] },
    { heading: 'Where to report', body: ['Cyber-fraud helpline: 1930.', 'National portal: cybercrime.gov.in.', 'Suspicious calls/SMS: Sanchar Saathi (Chakshu).'] },
  ]
}

function buildStructuredSummary(t?: ScamType, facet?: Facet, dim?: Dimension): { label: string; value: string }[] {
  return [
    { label: 'Scam type', value: t ? t.name : 'Multiple' },
    { label: 'Target', value: facet ? facet.name : 'General public (India)' },
    { label: 'Risk level', value: t && t.searchVolumeTier === 1 ? 'High' : 'Medium' },
    { label: 'Report to', value: '1930 / cybercrime.gov.in' },
    { label: 'Languages', value: 'English + हिन्दी' },
  ]
}

function buildInternalLinks(t?: ScamType, facet?: Facet, dim?: Dimension): InternalLink[] {
  const links: InternalLink[] = []
  // Related scams (other types) — topical clustering.
  for (const s of SCAM_TYPES.filter((s) => s.id !== t?.id).slice(0, 5)) {
    links.push({ anchor: s.name, href: `/scams/type/${s.id}`, group: 'related-scams' })
  }
  // Trending tier-1 scams.
  for (const s of SCAM_TYPES.filter((s) => s.searchVolumeTier === 1).slice(0, 4)) {
    if (s.id !== t?.id) links.push({ anchor: `${s.name} (trending)`, href: `/scams/type/${s.id}`, group: 'trending' })
  }
  // Facet cross-links.
  if (t) {
    links.push({ anchor: `${t.name} on WhatsApp`, href: `/scams/platform/whatsapp`, group: 'facet' })
    links.push({ anchor: `${t.name} via UPI`, href: `/scams/upi/google-pay`, group: 'facet' })
  } else if (facet && dim === 'city') {
    links.push({ anchor: `UPI fraud in ${facet.name}`, href: `/scams/type/upi-fraud/${facet.id}`, group: 'related-alerts' })
  }
  // Latest hub + live alerts feed (the scam-intel system).
  links.push({ anchor: 'Latest fraud patterns', href: '/scams', group: 'latest' })
  return dedupeLinks(links)
}

function buildBreadcrumb(a: AssembleArgs): { name: string; href: string }[] {
  const crumbs = [{ name: 'Scams', href: '/scams' }]
  if (a.kind === 'type' && a.t) crumbs.push({ name: a.t.name, href: a.path })
  if (a.kind === 'facet' && a.facet && a.dim) crumbs.push({ name: facetTopic(a.facet, a.dim), href: a.path })
  if (a.kind === 'combo' && a.t && a.facet) {
    crumbs.push({ name: a.t.name, href: `/scams/type/${a.t.id}` })
    crumbs.push({ name: a.facet.name, href: a.path })
  }
  return crumbs
}

function buildSchema(o: { title: string; metaDescription: string; canonical: string; h1: string; faq: FaqItem[]; breadcrumb: { name: string; href: string }[]; updatedAt: number }): object[] {
  const iso = new Date(o.updatedAt).toISOString()
  const org = { '@type': 'Organization', name: 'A Square Solutions', url: 'https://asquaresolution.com' }
  return [
    {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: o.h1, description: o.metaDescription, inLanguage: 'en-IN',
      datePublished: iso, dateModified: iso,
      mainEntityOfPage: { '@type': 'WebPage', '@id': o.canonical },
      author: org, publisher: { ...org, logo: { '@type': 'ImageObject', url: 'https://asquaresolution.com/logo.png' } },
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: o.faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: o.breadcrumb.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${BASE}${c.href}` })),
    },
  ]
}

// ── helpers ────────────────────────────────────────────────────────
function subjectLine(t?: ScamType, facet?: Facet, dim?: Dimension): string {
  if (t && facet) return `${t.name} ${dim === 'city' ? 'in' : 'on'} ${facet.name}`
  if (t) return t.name
  return facet ? `${facetTopic(facet, dim!)} scams` : 'scams'
}
function facetTopic(f: Facet, dim: Dimension): string {
  if (dim === 'city') return f.name
  if (dim === 'bank') return `${f.name}`
  if (dim === 'upi') return `${f.name}`
  if (dim === 'platform') return `${f.name}`
  return f.name
}
function lower(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1) }
function clip(s: string, n: number): string { return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…' }
function dedupeLinks(links: InternalLink[]): InternalLink[] {
  const seen = new Set<string>()
  return links.filter((l) => (seen.has(l.href + l.group) ? false : (seen.add(l.href + l.group), true)))
}

// ── Hub page ───────────────────────────────────────────────────────
export function buildHubPage(): PageModel {
  const path = '/scams'
  const canonical = `${BASE}${path}`
  const directAnswer = `Scammers in India most often use UPI fraud, OTP fraud, KYC-update fraud, and phishing. Verify any unexpected message in the official app, never share your OTP or UPI PIN, and report fraud to 1930 or cybercrime.gov.in.`
  const faq: FaqItem[] = [
    { question: 'What are the most common scams in India right now?', answer: 'UPI fraud, OTP fraud, KYC-update fraud, phishing links, fake job/task scams, and investment fraud are the most reported.' },
    { question: 'How do I report online fraud in India?', answer: 'Call the cyber-fraud helpline 1930 immediately and file a complaint at cybercrime.gov.in. Reporting within the “golden hour” improves the chance of recovering money.' },
    { question: 'Will a bank ever ask for my OTP?', answer: 'No. No bank, wallet, or company will ever ask for your OTP, UPI PIN, or CVV. Anyone who does is a scammer.' },
  ]
  const internalLinks: InternalLink[] = [
    ...SCAM_TYPES.map((t): InternalLink => ({ anchor: t.name, href: `/scams/type/${t.id}`, group: 'related-scams' })),
    ...SCAM_TYPES.filter((t) => t.searchVolumeTier === 1).map((t): InternalLink => ({ anchor: `${t.name}`, href: `/scams/type/${t.id}`, group: 'trending' })),
    { anchor: 'WhatsApp scams', href: '/scams/platform/whatsapp', group: 'facet' },
    { anchor: 'Telegram scams', href: '/scams/platform/telegram', group: 'facet' },
    { anchor: 'SBI scams', href: '/scams/bank/sbi', group: 'facet' },
    { anchor: 'UPI / Google Pay scams', href: '/scams/upi/google-pay', group: 'facet' },
  ]
  const references = referencesForType('upi-fraud')
  const trust = trustScore({ hasOfficialRefs: true, citationCount: references.length, hasHelpline: true, hasLastUpdated: true, factCount: 4, bilingual: true })
  const breadcrumb = [{ name: 'Scams', href: '/scams' }]
  return {
    kind: 'hub', path, canonical,
    title: 'Scam Alerts & Fraud Protection Guides (India) | ' + BRAND,
    metaDescription: clip(directAnswer, 158),
    h1: 'Scam Alerts & Fraud Protection (India)',
    directAnswer,
    verdict: 'Verdict: Unexpected + urgent + asks for money or codes = likely scam. Pause and verify.',
    riskLevel: 'High',
    quickBullets: [
      'Most common: UPI fraud, OTP fraud, KYC fraud, phishing.',
      'Never share OTP, UPI PIN, or CVV with anyone.',
      'Open official apps directly — never via links in messages.',
      'Report financial fraud to 1930 within the golden hour.',
    ],
    structuredSummary: [
      { label: 'Region', value: 'India' },
      { label: 'Top risk', value: 'UPI & OTP fraud' },
      { label: 'Report to', value: '1930 / cybercrime.gov.in' },
      { label: 'Languages', value: 'English + हिन्दी' },
    ],
    sections: [
      { heading: 'Browse scams by type', body: SCAM_TYPES.map((t) => `${t.name}: ${t.hook}`) },
    ],
    faq, references, internalLinks, breadcrumb, trust,
    discover: buildDiscoverMeta({ subject: 'scams in India', typeName: 'Scam Alerts', region: 'India', updatedAt: UPDATED_AT }),
    hi: {
      h1: 'स्कैम अलर्ट और धोखाधड़ी से बचाव (भारत)',
      directAnswer: 'भारत में सबसे आम स्कैम: UPI धोखाधड़ी, OTP धोखाधड़ी, KYC अपडेट धोखाधड़ी और फ़िशिंग। किसी भी अनचाहे मैसेज को आधिकारिक ऐप में जांचें, OTP या UPI पिन कभी साझा न करें, और धोखाधड़ी की रिपोर्ट 1930 पर करें।',
      verdict: 'नतीजा: अनचाहा + जल्दबाज़ी + पैसे/कोड की मांग = संभावित स्कैम।',
    },
    updatedAt: UPDATED_AT,
    schema: buildSchema({ title: 'Scam Alerts (India)', metaDescription: clip(directAnswer, 158), canonical, h1: 'Scam Alerts & Fraud Protection (India)', faq, breadcrumb, updatedAt: UPDATED_AT }),
  }
}

// ── Resolver: slug[] → PageModel ───────────────────────────────────
export function resolveScamPage(slugParts: string[]): PageModel | null {
  if (!slugParts || slugParts.length === 0) return buildHubPage()
  const [a, b, c] = slugParts
  if (a === 'type' && b && !c) return buildTypePage(b)
  if (a === 'type' && b && c) return buildComboPage(b, c)
  if ((a === 'city' || a === 'bank' || a === 'upi' || a === 'platform') && b && !c) {
    return buildFacetPage(a, b)
  }
  return null
}

// ── Static params enumeration (for generateStaticParams) ───────────
export { slug }
