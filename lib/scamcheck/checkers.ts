// ─────────────────────────────────────────────────────────────────
// lib/scamcheck/checkers.ts
// Catalog for the dedicated SEO landing pages (one per scan channel). Each maps
// to a Quick Analyzer tab + targeted copy/FAQ. Pure data → static pages.
// ─────────────────────────────────────────────────────────────────

export type CheckerTab = 'message' | 'link' | 'email' | 'phone' | 'screenshot'
export interface Checker {
  slug: string
  tab: CheckerTab
  h1: string
  title: string
  description: string
  intro: string
  faqs: { q: string; a: string }[]
}

export const CHECKERS: Checker[] = [
  {
    slug: 'whatsapp-scam-checker', tab: 'message', h1: 'WhatsApp Scam Checker',
    title: 'WhatsApp Scam Checker — Check if a WhatsApp Message Is a Scam | ScamCheck',
    description: 'Free WhatsApp scam checker. Paste a suspicious WhatsApp message and instantly detect phishing, fake refunds, KYC fraud, and impersonation. Multilingual interface (English/Hindi/Spanish).',
    intro: 'Paste any suspicious WhatsApp message below. ScamCheck reads it, extracts links/UPI IDs/phone numbers, flags fraud signals, and tells you the risk — instantly and free.',
    faqs: [
      { q: 'How do I check a WhatsApp message for a scam?', a: 'Paste the message text into the checker above. It detects phishing links, fake refund/KYC requests, OTP-sharing traps, and brand impersonation, then shows a risk score.' },
      { q: 'Are forwarded WhatsApp “job” and “refund” offers scams?', a: 'Most unsolicited offers promising easy money, refunds via QR/collect requests, or work-from-home registration fees are scams. Run them through the checker before acting.' },
    ],
  },
  {
    slug: 'sms-scam-checker', tab: 'message', h1: 'SMS Scam Checker',
    title: 'SMS Scam Checker — Check if a Text Message Is a Scam | ScamCheck',
    description: 'Free SMS scam checker. Paste a suspicious text message to detect fake bank alerts, KYC phishing, courier-fee fraud, and look-alike links. Instant risk score.',
    intro: 'Paste the SMS you received. ScamCheck flags fake bank alerts, KYC phishing, courier “customs fee” scams, and look-alike links in seconds.',
    faqs: [
      { q: 'Is a “your account will be blocked” SMS real?', a: 'Banks never suspend accounts via SMS links. Such messages are phishing — verify only in your official banking app.' },
      { q: 'What about courier “pending fee” texts?', a: 'Couriers do not collect fees by random SMS links. A small fee request via a link is bait to steal card details.' },
    ],
  },
  {
    slug: 'upi-scam-checker', tab: 'message', h1: 'UPI Scam Checker',
    title: 'UPI Scam Checker — Detect Fake Refund & QR Payment Scams | ScamCheck',
    description: 'Free UPI scam checker. Detect fake refund requests, QR “scan to receive” fraud, and collect-request scams on PhonePe, Google Pay, Paytm. Instant risk score.',
    intro: 'Paste the UPI message, request, or VPA. ScamCheck explains why “scan to receive” and refund collect-requests actually take your money.',
    faqs: [
      { q: 'Can scanning a QR receive money?', a: 'No. Scanning a QR or entering your UPI PIN always sends money. Receiving is automatic and needs no PIN.' },
      { q: 'Is a refund “collect request” safe to approve?', a: 'No. Approving a collect request pays the requester. Legitimate refunds never use collect requests.' },
    ],
  },
  {
    slug: 'email-scam-checker', tab: 'email', h1: 'Email Scam Checker',
    title: 'Email Scam Checker — Detect Phishing & Spoofed Sender Emails | ScamCheck',
    description: 'Free email scam checker. Paste a sender address or email content to detect phishing, spoofed/look-alike domains, and brand impersonation. Instant risk score.',
    intro: 'Paste the sender email or the email text. ScamCheck checks the domain for look-alikes/typosquats and flags phishing language.',
    faqs: [
      { q: 'How do I know if an email sender is fake?', a: 'Check the exact domain. Look-alikes like “hdfcbank-secure.com” or “asquaresolutlon.com” impersonate real brands — ScamCheck detects these automatically.' },
      { q: 'What is a homoglyph attack?', a: 'Scammers swap letters for look-alike characters (e.g. Cyrillic “а” for “a”) to fake a trusted domain. ScamCheck normalizes and flags these.' },
    ],
  },
  {
    slug: 'phone-scam-checker', tab: 'phone', h1: 'Phone Number Scam Checker',
    title: 'Phone Number Scam Checker — Check a Suspicious Number | ScamCheck',
    description: 'Free phone number scam checker. Check a suspicious caller or message number for scam patterns and unsafe call-back requests. Instant risk guidance.',
    intro: 'Paste the phone number from a suspicious call or message. ScamCheck flags unsafe call-back requests and combines it with any message context.',
    faqs: [
      { q: 'Should I call back an unknown number from a message?', a: 'No. Do not call numbers sent in unsolicited messages — verify using the number on the official website or card.' },
      { q: 'Are “+order/parcel” callback numbers safe?', a: 'Treat callback numbers in unexpected delivery or refund messages as high-risk; they often lead to fraud lines.' },
    ],
  },
  {
    slug: 'link-scam-checker', tab: 'link', h1: 'Link Scam Checker',
    title: 'Link Scam Checker — Check if a URL Is Safe or a Phishing Link | ScamCheck',
    description: 'Free link scam checker. Paste a URL to detect phishing, look-alike/typosquat domains, homoglyphs, punycode, shorteners, and suspicious TLDs. Instant risk score.',
    intro: 'Paste any link. ScamCheck inspects the domain for typosquatting, homoglyphs, punycode, shorteners, and deceptive subdomains.',
    faqs: [
      { q: 'How can I tell if a link is a phishing site?', a: 'Check the domain, not the text. Shorteners, suspicious TLDs (.xyz/.top), and brand look-alikes are red flags ScamCheck detects.' },
      { q: 'Is it safe to open a shortened link?', a: 'Avoid shortened/unknown links — they hide the real destination. Expand and check the domain first.' },
    ],
  },
  {
    slug: 'screenshot-scam-checker', tab: 'screenshot', h1: 'Screenshot Scam Checker',
    title: 'Screenshot Scam Checker — Upload a Screenshot to Detect Scams (AI OCR) | ScamCheck',
    description: 'Free AI screenshot scam checker. Upload a WhatsApp, SMS, UPI, or banking screenshot — OCR + AI vision extract the text and flag fraud signals and known scam campaigns.',
    intro: 'Upload a screenshot of any suspicious message, payment, or DM. AI OCR + vision read it and flag fraud signals — even in Hindi/Hinglish.',
    faqs: [
      { q: 'Can I check a scam by screenshot?', a: 'Yes. Upload or paste a screenshot; AI OCR extracts the text and ScamCheck flags fraud signals and similar known scams.' },
      { q: 'Is my screenshot stored?', a: 'No. Images are optimized on your device and processed in-request; they are not stored.' },
    ],
  },
]

export function allCheckerSlugs(): string[] { return CHECKERS.map((c) => c.slug) }
export function getChecker(slug: string): Checker | null { return CHECKERS.find((c) => c.slug === slug) ?? null }
