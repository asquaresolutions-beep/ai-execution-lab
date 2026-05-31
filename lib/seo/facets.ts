// ─────────────────────────────────────────────────────────────────
// lib/seo/facets.ts
// India-first structured data powering programmatic SEO pages.
// All content is deterministic (no AI) → accurate, free, fast to build.
//
// Dimensions: scam types, cities, banks, UPI apps, social platforms.
// Each entry carries the metadata the page generator needs to assemble
// titles, direct answers, bullets, FAQs, and bilingual (en/hi) copy.
// ─────────────────────────────────────────────────────────────────

export type Dimension = 'type' | 'city' | 'bank' | 'upi' | 'platform'

export interface ScamType {
  id: string            // slug
  name: string          // English display
  nameHi: string        // Hindi display
  aka: string[]         // synonyms / search variants
  hook: string          // how it works, one line
  signs: string[]       // warning signs
  protect: string[]     // protective actions
  searchVolumeTier: 1 | 2 | 3  // 1 = highest demand
}

export interface Facet {
  id: string
  name: string
  nameHi?: string
  kind: Dimension
  meta?: Record<string, string>
}

// ── Scam types (the topical core) ──────────────────────────────────
export const SCAM_TYPES: ScamType[] = [
  { id: 'upi-fraud', name: 'UPI Fraud', nameHi: 'UPI धोखाधड़ी', aka: ['UPI scam', 'collect request scam', 'autopay fraud'],
    hook: 'Fraudsters send a fake "collect request" or trick you into approving a payment you think is a refund.',
    signs: ['A "refund" that asks you to APPROVE or enter your UPI PIN', 'Unknown collect requests', 'Pressure to act within minutes'],
    protect: ['Never enter your UPI PIN to RECEIVE money', 'Decline unknown collect requests', 'Verify with the official app, not links'],
    searchVolumeTier: 1 },
  { id: 'otp-fraud', name: 'OTP Fraud', nameHi: 'OTP धोखाधड़ी', aka: ['OTP scam', 'otp sharing fraud'],
    hook: 'A caller impersonates your bank and pressures you to read out the OTP sent to your phone.',
    signs: ['Anyone asking for your OTP', 'Caller claims to be "bank security"', 'Threat that your account will be blocked'],
    protect: ['No bank or company ever needs your OTP', 'Hang up and call the number on your card', 'Report to 1930 immediately'],
    searchVolumeTier: 1 },
  { id: 'kyc-fraud', name: 'KYC Fraud', nameHi: 'KYC धोखाधड़ी', aka: ['KYC update scam', 're-KYC scam', 'fake kyc'],
    hook: 'A message says your KYC has expired and your account will be frozen unless you "update" via a link or app.',
    signs: ['Urgent KYC link by SMS/WhatsApp', 'Request to install AnyDesk/TeamViewer', 'Link domain is not your bank’s official site'],
    protect: ['Banks do not update KYC via random links', 'Never install screen-sharing apps for "KYC"', 'Use only the official banking app'],
    searchVolumeTier: 1 },
  { id: 'phishing', name: 'Phishing', nameHi: 'फ़िशिंग', aka: ['phishing link', 'fake website scam', 'smishing'],
    hook: 'A fake website or link mimics a trusted brand to steal your login or card details.',
    signs: ['Misspelled or odd URL', 'Shortened link (bit.ly) in an "official" message', 'Urgent call to "verify" details'],
    protect: ['Check the exact domain before logging in', 'Type the website yourself instead of tapping links', 'Enable 2-factor authentication'],
    searchVolumeTier: 1 },
  { id: 'fake-job', name: 'Fake Job Scam', nameHi: 'फ़र्ज़ी नौकरी घोटाला', aka: ['work from home scam', 'task scam', 'part time job fraud'],
    hook: 'A "recruiter" offers easy daily earnings, then asks for a registration fee or for you to do paid "tasks".',
    signs: ['Upfront fee to start work', 'Telegram/WhatsApp "task" groups', 'Earnings that sound too good to be true'],
    protect: ['Legitimate jobs never charge you to join', 'Never deposit money to "unlock" earnings', 'Verify the company independently'],
    searchVolumeTier: 1 },
  { id: 'investment-fraud', name: 'Investment Fraud', nameHi: 'निवेश धोखाधड़ी', aka: ['stock tip scam', 'crypto scam', 'trading scam'],
    hook: 'Guaranteed high returns via WhatsApp/Telegram "advisors" or fake trading apps that block withdrawals.',
    signs: ['Guaranteed or fixed high returns', 'Pressure to invest more to withdraw', 'Unregistered advisor or app'],
    protect: ['No real investment guarantees returns', 'Check SEBI registration', 'Be suspicious if you cannot withdraw'],
    searchVolumeTier: 1 },
  { id: 'loan-scam', name: 'Loan App Scam', nameHi: 'लोन ऐप घोटाला', aka: ['instant loan scam', 'loan app harassment'],
    hook: 'Predatory apps offer instant loans, then harass and blackmail using your contacts and photos.',
    signs: ['Loan approved with no checks', 'App demands contacts/gallery access', 'Threats and hidden charges'],
    protect: ['Use only RBI-regulated lenders', 'Deny unnecessary app permissions', 'Report harassment to 1930 and cyber police'],
    searchVolumeTier: 2 },
  { id: 'courier-scam', name: 'Courier / Customs Scam', nameHi: 'कूरियर घोटाला', aka: ['fedex scam', 'parcel scam', 'customs fraud'],
    hook: 'A caller claims a parcel in your name contains illegal items and demands money to "settle" it.',
    signs: ['Call about a suspicious parcel/drugs', 'Threat of arrest', 'Demand to transfer money to "verify"'],
    protect: ['Police never settle cases over UPI', 'Hang up; do not transfer money', 'Report to 1930'],
    searchVolumeTier: 2 },
  { id: 'electricity-bill-scam', name: 'Electricity Bill Scam', nameHi: 'बिजली बिल घोटाला', aka: ['power disconnection scam', 'bijli bill scam'],
    hook: 'An SMS threatens power disconnection tonight unless you call a number and pay immediately.',
    signs: ['SMS from a personal number', 'Threat of same-day disconnection', 'Asked to install an app or pay via link'],
    protect: ['Check bills only in the official discom app', 'Never install apps from such messages', 'Call your provider’s official number'],
    searchVolumeTier: 2 },
  { id: 'lottery-scam', name: 'Lottery / Prize Scam', nameHi: 'लॉटरी घोटाला', aka: ['kbc lottery scam', 'lucky draw scam', 'prize fraud'],
    hook: 'You "won" a lottery you never entered; to claim it you must pay a fee or tax first.',
    signs: ['Winning a contest you never entered', 'Fee/tax required to release the prize', 'Pressure and secrecy'],
    protect: ['Real prizes never require an upfront fee', 'Ignore and block', 'Never share bank or OTP details'],
    searchVolumeTier: 3 },
  { id: 'tech-support-scam', name: 'Tech Support Scam', nameHi: 'टेक सपोर्ट घोटाला', aka: ['fake support scam', 'remote access fraud'],
    hook: 'A fake "support agent" claims your device is infected and asks for remote access or payment.',
    signs: ['Unsolicited support calls/popups', 'Request to install AnyDesk/TeamViewer', 'Payment via gift cards or UPI'],
    protect: ['Real companies don’t cold-call about viruses', 'Never grant remote access to strangers', 'Close the popup and run trusted antivirus'],
    searchVolumeTier: 3 },
  { id: 'romance-scam', name: 'Romance Scam', nameHi: 'रोमांस घोटाला', aka: ['dating scam', 'matrimony fraud'],
    hook: 'An online partner builds trust over weeks, then invents an emergency and asks for money.',
    signs: ['Quick declarations of love', 'Always has an excuse to never meet', 'Sudden money emergency'],
    protect: ['Never send money to someone you haven’t met', 'Reverse-image-search their photos', 'Talk to a trusted friend first'],
    searchVolumeTier: 3 },
]

// ── Cities (top metros + tier-2, highest fraud-report demand) ──────
const CITY_NAMES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
  'Jaipur', 'Lucknow', 'Surat', 'Kanpur', 'Nagpur', 'Indore', 'Bhopal', 'Patna',
  'Chandigarh', 'Gurugram', 'Noida', 'Thane', 'Visakhapatnam', 'Coimbatore', 'Kochi',
  'Guwahati', 'Bhubaneswar',
]
export const CITIES: Facet[] = CITY_NAMES.map((name) => ({ id: slug(name), name, kind: 'city' }))

// ── Banks (most-impersonated in India) ─────────────────────────────
const BANK_NAMES = [
  'SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Punjab National Bank', 'Bank of Baroda',
  'Kotak Mahindra Bank', 'Canara Bank', 'Union Bank of India', 'IDFC FIRST Bank',
  'Yes Bank', 'IndusInd Bank',
]
export const BANKS: Facet[] = BANK_NAMES.map((name) => ({ id: slug(name), name, kind: 'bank' }))

// ── UPI apps ───────────────────────────────────────────────────────
const UPI_NAMES = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Amazon Pay', 'Cred', 'WhatsApp Pay', 'Mobikwik']
export const UPI_APPS: Facet[] = UPI_NAMES.map((name) => ({ id: slug(name), name, kind: 'upi' }))

// ── Social / messaging platforms ───────────────────────────────────
const PLATFORM_NAMES = ['WhatsApp', 'Telegram', 'Instagram', 'Facebook', 'SMS', 'Email', 'YouTube', 'X (Twitter)']
export const PLATFORMS: Facet[] = PLATFORM_NAMES.map((name) => ({ id: slug(name), name, kind: 'platform' }))

// ── Lookups ────────────────────────────────────────────────────────
export const SCAM_TYPE_BY_ID = new Map(SCAM_TYPES.map((t) => [t.id, t]))
export const FACETS_BY_DIMENSION: Record<Exclude<Dimension, 'type'>, Facet[]> = {
  city: CITIES, bank: BANKS, upi: UPI_APPS, platform: PLATFORMS,
}
export function facetById(dim: Exclude<Dimension, 'type'>, id: string): Facet | undefined {
  return FACETS_BY_DIMENSION[dim]?.find((f) => f.id === id)
}

// Top combos (type × city) we want statically generated. Caps the page
// count to keep builds fast + hobby-friendly.
export const COMBO_TYPES = SCAM_TYPES.filter((t) => t.searchVolumeTier <= 2).map((t) => t.id)
export const COMBO_CITIES = CITIES.slice(0, 20).map((c) => c.id)

export function slug(s: string): string {
  return s.toLowerCase().replace(/[()]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
}
