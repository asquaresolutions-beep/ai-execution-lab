// ─────────────────────────────────────────────────────────────────
// lib/scamcheck/checker-content.ts
// Long-form, per-channel content for the SEO checker landing pages — how the
// scams work, red flags, real examples, and protection steps. Combined with
// each checker's intro + FAQ + JSON-LD, this gives substantial unique copy.
// ─────────────────────────────────────────────────────────────────

import type { CheckerTab } from '@/lib/scamcheck/checkers'

export interface CheckerContent { howItWorks: string[]; redFlags: string[]; examples: string[]; protect: string[] }

const SHARED_PROTECT = [
  'Never share an OTP, PIN, CVV, or password — no bank or company ever asks for them.',
  'Verify in the official app or website you typed yourself — never via a link in a message.',
  'Slow down: scammers manufacture urgency ("account blocked", "act now") to stop you thinking.',
  'If money was lost or details shared, contact your bank immediately and report to your national cybercrime agency.',
]

export const CHECKER_CONTENT: Record<CheckerTab, CheckerContent> = {
  message: {
    howItWorks: [
      'You receive an unsolicited SMS or WhatsApp message claiming to be from a bank, wallet, delivery company, or government body.',
      'It creates urgency — your account will be blocked, a refund is pending, or a parcel is held — and pushes you to a link or a phone number.',
      'The link leads to a look-alike page that harvests your credentials, OTP, or card/UPI details; the number connects to a fraud line.',
      'Once you enter details or approve a payment, money or account access is gone.',
    ],
    redFlags: ['Urgency and threats ("blocked today", "within 24 hours")', 'Links to non-official or shortened domains', 'Requests for OTP/PIN/KYC details', 'Unexpected refunds, prizes, or job offers', 'Pressure to move to WhatsApp or call a number'],
    examples: ['"Dear customer, your SBI account will be BLOCKED today. Update KYC: http://sbi-kyc-verify.xyz"', '"You have a pending refund of ₹4,999 — scan the QR to receive it."', '"Congratulations! Work from home, earn ₹5000 daily. Pay ₹199 to start."'],
    protect: SHARED_PROTECT,
  },
  link: {
    howItWorks: [
      'Scammers register look-alike domains — typosquats (sbi-kyc-verify), homoglyphs (using look-alike characters), or deceptive subdomains (hdfcbank.secure-login.top).',
      'They hide the destination behind link shorteners or suspicious TLDs (.xyz, .top, .click).',
      'The page mimics a real login or payment screen to capture your credentials or card details.',
    ],
    redFlags: ['Shorteners (bit.ly, tinyurl) or odd TLDs', 'Brand names as a subdomain with a different root domain', 'Misspelled or character-swapped brand names', 'http:// (no HTTPS) on a "bank" page'],
    examples: ['http://sbi-kyc-verify.xyz', 'http://hdfcbank.secure-login.top', 'https://asquaresolutlon.com (note the "l" instead of "i")'],
    protect: ['Read the domain, not the link text — check the part right before the final ".com/.in".', ...SHARED_PROTECT.slice(0, 3)],
  },
  email: {
    howItWorks: [
      'Phishing emails spoof a trusted sender or use a look-alike domain (paytm-refund.top, hdfcbank-secure.com).',
      'They include a call to action — verify, re-activate, claim a refund — linking to a credential-harvesting page.',
      'Attachments or links may also deliver malware.',
    ],
    redFlags: ['Sender domain that isn’t the brand’s official domain', 'Generic greetings + urgent demands', 'Mismatched or look-alike "from" address', 'Requests for login, card, or KYC details'],
    examples: ['support@paytm-refund.top', 'alerts@hdfcbank-secure.com', 'noreply@asquare-solution.com (extra hyphen)'],
    protect: ['Check the exact sender domain; official mail comes from the brand’s real domain.', ...SHARED_PROTECT.slice(0, 3)],
  },
  phone: {
    howItWorks: [
      'A caller or message poses as your bank, a delivery agent, or "customer care" and asks you to confirm details or pay a small fee.',
      'They may spoof caller ID or send a callback number in an unexpected refund/parcel message.',
      'The goal is your OTP, card details, or a remote-access app install.',
    ],
    redFlags: ['Callback numbers in unsolicited messages', 'Requests to install screen-sharing/remote apps', 'Demands for OTP or "verification" payments', 'High-pressure "act now" calls'],
    examples: ['"Call this number to release your parcel: +91 98xxxxxxxx"', '"Your card is blocked — share the OTP to reactivate."'],
    protect: ['Never call back numbers from unsolicited messages — use the number on the official website or card.', ...SHARED_PROTECT.slice(0, 3)],
  },
  screenshot: {
    howItWorks: [
      'You receive a screenshot or image — a fake payment "success", a spoofed bank/UPI screen, or a chat — designed to look legitimate.',
      'ScamCheck runs OCR (and AI vision) to read the text, then applies the same fraud detection as for messages.',
      'It flags fake payment confirmations, spoofed UI, OTP requests, and brand impersonation.',
    ],
    redFlags: ['"Payment successful" screens you didn’t initiate', 'Spoofed bank/UPI logos or mismatched fonts', 'QR / "collect request" to "receive" money', 'OTP-sharing requests in the image'],
    examples: ['A fake "₹4,999 received — scan QR to credit" screen', 'A spoofed bank app KYC-suspension screen', 'A WhatsApp "support" chat asking for an OTP'],
    protect: ['A real credit never needs you to scan a QR or share a PIN/OTP to "receive".', ...SHARED_PROTECT.slice(0, 3)],
  },
}
