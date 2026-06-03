// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/intel-pages.ts
// Curated public scam-intelligence catalog — SEO landing pages for named scam
// campaigns. Deterministic (renders statically, no live dependency) so the
// pages are crawlable + fast. Mirrors the detector knowledge so the on-page
// red-flags match what the ScamCheck screenshot tool actually detects.
// ─────────────────────────────────────────────────────────────────

export interface IntelFaq { question: string; answer: string }
export interface IntelPage {
  slug: string
  title: string                  // <title>
  h1: string
  metaDescription: string
  category: string               // matches scam-intel category
  country?: string               // ISO-2; drives localized reporting + schema (default IN)
  lang?: string                  // BCP-47 for inLanguage (default en-IN)
  brands: string[]
  directAnswer: string           // answer-first paragraph (GEO/AI-Overview)
  howItWorks: string[]
  redFlags: string[]
  exampleText: string            // representative scam message
  safetyAdvice: string[]
  faqs: IntelFaq[]
  related: string[]              // other intel slugs
  updated: string                // ISO date
}

const UPDATED = '2026-06-03'

export const INTEL_PAGES: IntelPage[] = [
  {
    slug: 'fake-sbi-kyc-scam',
    title: 'Fake SBI KYC Scam — How to Spot the "Account Will Be Blocked" Message | ScamCheck',
    h1: 'Fake SBI KYC Suspension Scam',
    metaDescription: 'A fake SBI KYC message says your account will be blocked unless you verify via a link. Learn how the scam works, the red flags, and how to check a screenshot instantly with ScamCheck.',
    category: 'phishing',
    brands: ['SBI', 'HDFC', 'ICICI'],
    directAnswer: 'A "fake SBI KYC" message claims your bank account will be blocked today unless you complete KYC through a link. It is a phishing scam — real banks never suspend accounts over SMS/WhatsApp links or ask you to "verify" on a non-bank website. Do not click the link; update KYC only at a branch or the official bank app.',
    howItWorks: [
      'You receive an SMS/WhatsApp claiming your KYC is incomplete and the account will be blocked "today".',
      'It links to a look-alike domain (e.g. sbi-kyc-verify.xyz) that mimics the bank login page.',
      'Entering your credentials or OTP hands the scammer access to your account or card.',
    ],
    redFlags: ['Urgency ("blocked today", "within 24 hours")', 'A link to a non-official domain / shortener', 'Asks you to "verify" KYC online instead of at a branch', 'Requests an OTP, PIN, or card details'],
    exampleText: 'Dear Customer, your SBI account will be BLOCKED today due to incomplete KYC. Update immediately at http://sbi-kyc-verify.xyz or your account is suspended.',
    safetyAdvice: ['Never click KYC links in SMS/WhatsApp.', 'Update KYC only at a branch or the official app.', 'Never share an OTP, PIN, or CVV.', 'Report at cybercrime.gov.in or call 1930.'],
    faqs: [
      { question: 'Does SBI block accounts over SMS?', answer: 'No. Banks do not suspend accounts via SMS/WhatsApp links. KYC is updated in person or through the official app.' },
      { question: 'I clicked the link — what now?', answer: 'Do not enter details. If you already did, call your bank to block the card/account and report at cybercrime.gov.in or 1930.' },
    ],
    related: ['fake-upi-refund-scam', 'fake-courier-customs-scam'],
    updated: UPDATED,
  },
  {
    slug: 'fake-upi-refund-scam',
    title: 'Fake UPI Refund Scam — Why "Scan to Receive Money" Steals Your Money | ScamCheck',
    h1: 'Fake UPI Refund / QR Collection Scam',
    metaDescription: 'A fake UPI refund asks you to scan a QR or approve a collect request to "receive" money. Scanning or approving SENDS money. Learn the red flags and verify a screenshot with ScamCheck.',
    category: 'upi_fraud',
    brands: ['Paytm', 'PhonePe', 'Google Pay'],
    directAnswer: 'A "fake UPI refund" scam tells you to scan a QR code or approve a "collect request" to receive a refund. In UPI, scanning a QR or approving a collect request SENDS money from your account — it never receives it. No legitimate refund ever requires you to scan or approve anything.',
    howItWorks: [
      'You are told a refund of ₹X is pending and shown a QR or a collect request.',
      'Scanning the QR / approving the request authorises a payment FROM your account.',
      'You enter your UPI PIN believing you are "receiving", and the money leaves instead.',
    ],
    redFlags: ['"Scan this QR to receive money"', 'A UPI "collect request" to claim a refund', 'Urgency ("refund will be cancelled")', 'Being asked for your UPI PIN to receive money'],
    exampleText: 'Congratulations! You have received a refund of ₹4,999. To credit it, scan the QR or approve the collect request in your UPI app.',
    safetyAdvice: ['Receiving money on UPI never needs your PIN or a QR scan.', 'Decline unknown collect requests.', 'Verify refunds in the original app/order, not via messages.', 'Report at cybercrime.gov.in or 1930.'],
    faqs: [
      { question: 'Can I receive money by scanning a QR?', answer: 'No. Scanning a QR or entering your UPI PIN always SENDS money. Receiving is automatic and needs no PIN.' },
      { question: 'Is a "collect request" for a refund safe?', answer: 'No. Approving a collect request pays the requester. Legitimate refunds never use collect requests.' },
    ],
    related: ['fake-sbi-kyc-scam', 'fake-telegram-investment-scam'],
    updated: UPDATED,
  },
  {
    slug: 'fake-courier-customs-scam',
    title: 'Fake Courier Customs Fee Scam — "Parcel Held, Pay to Release" | ScamCheck',
    h1: 'Fake Courier / Customs Fee Scam',
    metaDescription: 'A fake courier message (India Post, Blue Dart, FedEx) says your parcel is held at customs and asks for a small fee via a link. Learn the red flags and verify a screenshot with ScamCheck.',
    category: 'courier_customs',
    brands: ['India Post', 'Blue Dart', 'FedEx', 'DTDC'],
    directAnswer: 'A "fake courier customs" scam claims your parcel is stuck at customs and asks for a small fee through a link. Couriers collect duties through official channels, not random SMS links — paying captures your card details. Do not pay; verify with the courier directly.',
    howItWorks: [
      'You get an SMS/WhatsApp that a parcel is "held at customs" with a small pending fee.',
      'The link leads to a payment page that harvests your card/UPI details.',
      'The small "fee" is bait; the real goal is your payment credentials.',
    ],
    redFlags: ['A small "customs/handling fee" via a link', 'Urgency ("parcel returns in 24 hours")', 'Shortened or look-alike courier domain', 'Unexpected parcel you did not order'],
    exampleText: 'India Post: Your parcel is held at customs. Pay ₹25 customs fee to release: http://bit.ly/parcel-pay. Failure to pay within 24 hours returns the parcel.',
    safetyAdvice: ['Track parcels only on the official courier site.', 'Never pay "customs" via SMS links.', 'A tiny fee is a red flag, not reassurance.', 'Report at cybercrime.gov.in or 1930.'],
    faqs: [
      { question: 'Do couriers charge customs over SMS?', answer: 'No. Duties are paid through official channels with documentation, not random SMS links.' },
      { question: 'The fee is only ₹25 — is it safe?', answer: 'No. The small fee is bait to capture your card details for larger fraud.' },
    ],
    related: ['fake-sbi-kyc-scam', 'fake-upi-refund-scam'],
    updated: UPDATED,
  },
  {
    slug: 'fake-telegram-investment-scam',
    title: 'Fake Telegram Investment Scam — "Guaranteed 30% Returns" VIP Groups | ScamCheck',
    h1: 'Fake Telegram / WhatsApp Investment Scam',
    metaDescription: 'Telegram/WhatsApp "VIP" groups promising guaranteed stock/crypto returns are investment scams. Learn how they work, the red flags, and verify a screenshot with ScamCheck.',
    category: 'investment_fraud',
    brands: ['Telegram', 'WhatsApp'],
    directAnswer: 'A "fake Telegram investment" scam invites you to a VIP group promising guaranteed high returns on stocks or crypto. Guaranteed returns do not exist; early "profits" are shown to lure larger deposits, which then vanish. No SEBI-registered advisor guarantees returns or operates only via Telegram.',
    howItWorks: [
      'You are added to a Telegram/WhatsApp "VIP trading" group with screenshots of huge profits.',
      'A small first deposit shows a fake "profit" to build trust.',
      'You are pushed to invest more; withdrawals are blocked or require more "fees".',
    ],
    redFlags: ['"Guaranteed" or fixed daily returns', 'VIP group, pay-to-join, or a personal handler', 'Pressure to deposit quickly / limited seats', 'Withdrawals need extra "tax" or "fee"'],
    exampleText: 'Earn 30% guaranteed returns! Join our stock VIP group on WhatsApp +9198xxxxxx. Limited seats, invest ₹9,999 today.',
    safetyAdvice: ['No legitimate investment guarantees returns.', 'Verify advisors on the SEBI register.', 'Never deposit to "unlock" a withdrawal.', 'Report at cybercrime.gov.in or 1930.'],
    faqs: [
      { question: 'Are guaranteed-return trading groups legal?', answer: 'No. Guaranteed returns are a hallmark of fraud; SEBI-registered advisors cannot promise them.' },
      { question: 'I made a profit on the first deposit — is it real?', answer: 'The first "profit" is fake bait. Once you deposit more, withdrawals are blocked.' },
    ],
    related: ['fake-upi-refund-scam', 'fake-sbi-kyc-scam'],
    updated: UPDATED,
  },
]

// ── Geo-aware SEO pages (country-framed landing pages) ─────────────
const GEO_PAGES: IntelPage[] = [
  {
    slug: 'upi-scams-india', country: 'IN', lang: 'en-IN', category: 'upi_fraud', brands: ['Paytm', 'PhonePe', 'Google Pay', 'BHIM'],
    title: 'UPI Scams in India — Refund, Collect-Request & QR Fraud | ScamCheck',
    h1: 'UPI Scams in India',
    metaDescription: 'The most common UPI scams in India — fake refunds, collect requests, and QR fraud — how they work, the red flags, and an instant screenshot checker.',
    directAnswer: 'UPI scams in India trick you into APPROVING a payment (via a QR scan or collect request) while believing you are receiving money. On UPI, you never enter a PIN to receive funds — only to send them. Decline unknown collect requests and never scan a QR to "get a refund".',
    howItWorks: ['You are told a refund/prize is pending and shown a QR or collect request.', 'Approving it or entering your UPI PIN sends money from your account.', 'Scammers often pose as Paytm/PhonePe/Google Pay support to add pressure.'],
    redFlags: ['"Scan QR to receive money"', 'UPI collect request to claim a refund', 'Being asked for your UPI PIN to receive', 'Urgency ("refund will lapse")'],
    exampleText: 'You have received a refund of ₹4,999. Scan the QR or approve the collect request in your PhonePe app to credit it.',
    safetyAdvice: ['Receiving money never needs a PIN or QR scan.', 'Decline unknown collect requests.', 'Verify refunds in the original app/order.', 'Report at cybercrime.gov.in or call 1930.'],
    faqs: [
      { question: 'Can scanning a UPI QR receive money?', answer: 'No. Scanning a QR or entering your UPI PIN always sends money. Receiving is automatic.' },
      { question: 'Where do I report UPI fraud in India?', answer: 'Call 1930 or report at cybercrime.gov.in, and inform your bank immediately.' },
    ],
    related: ['fake-upi-refund-scam', 'fake-sbi-kyc-scam'], updated: UPDATED,
  },
  {
    slug: 'irs-scams-usa', country: 'US', lang: 'en-US', category: 'tech_support', brands: ['IRS'],
    title: 'IRS Scams in the USA — Fake Tax Calls, Gift-Card & Arrest Threats | ScamCheck',
    h1: 'IRS / Tax Scams in the United States',
    metaDescription: 'Fake IRS scams threaten arrest or demand payment by gift card, wire, or crypto. Learn the red flags and check a suspicious message screenshot instantly.',
    directAnswer: 'An "IRS scam" in the USA threatens arrest, deportation, or license suspension unless you pay immediately — often by gift card, wire, or crypto. The IRS never initiates contact by phone/text demanding instant payment, and never accepts gift cards. Hang up and report it.',
    howItWorks: ['You get a call/text claiming you owe back taxes with an arrest warrant pending.', 'You are pressured to pay instantly via gift card, wire, or crypto.', 'Caller ID may be spoofed to look official.'],
    redFlags: ['Threats of arrest/deportation over unpaid tax', 'Demand for gift cards, wire, or crypto', 'Refusal to let you verify or call back', 'Urgency and secrecy'],
    exampleText: 'IRS FINAL NOTICE: a warrant is issued for your arrest over unpaid taxes. Pay $1,999 via gift card within 1 hour to avoid prosecution.',
    safetyAdvice: ['The IRS never demands gift cards or threatens arrest by phone.', 'Do not pay; hang up.', 'Verify any tax issue at irs.gov.', 'Report at reportfraud.ftc.gov.'],
    faqs: [
      { question: 'Does the IRS call you about owed taxes?', answer: 'The IRS generally contacts you by mail first and never demands instant payment by gift card or threatens arrest.' },
      { question: 'Where do I report an IRS scam?', answer: 'Report at reportfraud.ftc.gov and to the Treasury Inspector General (TIGTA).' },
    ],
    related: ['fake-telegram-investment-scam'], updated: UPDATED,
  },
  {
    slug: 'courier-scams-uk', country: 'GB', lang: 'en-GB', category: 'courier_customs', brands: ['Royal Mail', 'DPD', 'Evri'],
    title: 'Courier & Parcel Scams in the UK — Fake Royal Mail / DPD Texts | ScamCheck',
    h1: 'Courier / Parcel Scams in the United Kingdom',
    metaDescription: 'Fake Royal Mail, DPD, and Evri texts say a parcel needs a small redelivery or customs fee via a link. Learn the red flags and check a screenshot instantly.',
    directAnswer: 'A UK courier scam texts that your parcel needs a small "redelivery" or "customs" fee paid through a link. Couriers do not collect fees by random SMS links — the page harvests your card details. Do not pay; verify on the official courier site and forward the text to 7726.',
    howItWorks: ['You get a text that a parcel is held pending a small fee.', 'The link leads to a fake card-payment page.', 'The small fee is bait; the real goal is your card details for larger fraud.'],
    redFlags: ['A small "redelivery/customs fee" via a link', 'Look-alike courier domain or shortener', 'Urgency ("parcel returned in 48 hours")', 'Unexpected parcel'],
    exampleText: 'Royal Mail: your parcel is awaiting a £1.99 redelivery fee. Pay now to reschedule: http://royalmail-redelivery.top',
    safetyAdvice: ['Track parcels only on the official courier site.', 'Never pay courier fees via SMS links.', 'Forward scam texts to 7726.', 'Report to Action Fraud (0300 123 2040).'],
    faqs: [
      { question: 'Does Royal Mail text for redelivery fees?', answer: 'Royal Mail uses a grey "Fee to pay" card, not random SMS links demanding card details.' },
      { question: 'Where do I report a courier scam in the UK?', answer: 'Forward the text to 7726 and report at actionfraud.police.uk.' },
    ],
    related: ['fake-courier-customs-scam'], updated: UPDATED,
  },
  {
    slug: 'telegram-investment-scams-singapore', country: 'SG', lang: 'en-SG', category: 'investment_fraud', brands: ['Telegram'],
    title: 'Telegram Investment Scams in Singapore — Fake VIP Trading Groups | ScamCheck',
    h1: 'Telegram Investment Scams in Singapore',
    metaDescription: 'Telegram "VIP" groups in Singapore promising guaranteed trading or crypto returns are investment scams. Learn the red flags and check a screenshot instantly.',
    directAnswer: 'Telegram investment scams in Singapore add you to "VIP" groups promising guaranteed stock or crypto returns. Early fake "profits" lure larger deposits which then cannot be withdrawn. No MAS-regulated firm guarantees returns or operates only via Telegram.',
    howItWorks: ['You are added to a Telegram VIP trading group full of "profit" screenshots.', 'A small deposit shows a fake profit to build trust.', 'Withdrawals are blocked until you pay more "tax" or "fees".'],
    redFlags: ['Guaranteed or fixed daily returns', 'VIP group with a personal "mentor"', 'Pressure to deposit quickly', 'Withdrawals need extra fees'],
    exampleText: 'Join our VIP trading group! Guaranteed 25% weekly returns. Deposit S$2,000 today, limited slots.',
    safetyAdvice: ['No legitimate investment guarantees returns.', 'Check the MAS Financial Institutions Directory and Investor Alert List.', 'Never pay to "unlock" a withdrawal.', 'Report via ScamShield (1799).'],
    faqs: [
      { question: 'Are guaranteed-return Telegram groups legal in Singapore?', answer: 'No. Guaranteed returns are a hallmark of fraud; MAS-regulated firms cannot promise them.' },
      { question: 'Where do I report a scam in Singapore?', answer: 'Call the ScamShield helpline 1799 or report at scamshield.gov.sg.' },
    ],
    related: ['fake-telegram-investment-scam'], updated: UPDATED,
  },
]

INTEL_PAGES.push(...GEO_PAGES)

export function allIntelSlugs(): string[] { return INTEL_PAGES.map((p) => p.slug) }
export function getIntelPage(slug: string): IntelPage | null { return INTEL_PAGES.find((p) => p.slug === slug) ?? null }
