// ─────────────────────────────────────────────────────────────────
// lib/newsletter/lead-magnets.ts  (asq-acquisition-v1)
// Shared lead-magnet definitions for the NewsletterCapture component. A magnet is
// a static asset in /public delivered as an instant download in the signup success
// state — no email send, no backend. Single source of truth so every placement
// links the same asset + title.
// ─────────────────────────────────────────────────────────────────
export interface LeadMagnet { href: string; title: string }

/** Fake UPI Scam Detection Guide — static asset at public/guides/. */
export const FAKE_UPI_MAGNET: LeadMagnet = {
  href: '/guides/fake-upi-scam-detection-guide.html',
  title: 'Fake UPI Scam Detection Guide',
}
