// ─────────────────────────────────────────────────────────────────
// lib/newsletter/welcome-copy.ts  (asq-welcome-seq-v1)
// Pure, dependency-free definition of the 4-email welcome onboarding drip:
//   Day 0 Welcome (already sent at signup by notifyNewsletter — step 0)
//   Day 2 Scam Awareness          (step 1)
//   Day 5 ScamCheck Tutorial      (step 2)
//   Day 9 TrustSeal + Lab intro   (step 3)
// No project imports → unit-testable under `node --experimental-strip-types`.
// Copy is deterministic (no AI/Vertex). Branding matches the existing wrap().
// ─────────────────────────────────────────────────────────────────

export interface WelcomeStepDef { step: number; offsetDays: number; subject: string }

/** Drip steps AFTER the Day-0 signup welcome (which is step 0, sent on subscribe). */
export const WELCOME_STEPS: readonly WelcomeStepDef[] = [
  { step: 1, offsetDays: 2, subject: 'The scams hitting Indians most right now' },
  { step: 2, offsetDays: 5, subject: 'How to check any suspicious message in 30 seconds' },
  { step: 3, offsetDays: 9, subject: 'Two more tools we built for you' },
] as const

export const MAX_WELCOME_STEP = 3
export const DAY_MS = 86_400_000

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
const hi = (name?: string) => `Hi${name ? ' ' + esc(name.slice(0, 60)) : ''},`

/** Inner HTML body for a drip step (wrapped by notify.ts's wrap() + unsubFooter). */
export function welcomeEmail(step: number, name?: string): { subject: string; title: string; bodyHtml: string } | null {
  switch (step) {
    case 1:
      return {
        subject: WELCOME_STEPS[0].subject,
        title: 'Know the playbook, spot the scam',
        bodyHtml: `
      <p>${hi(name)} most scams in India right now follow three playbooks:</p>
      <ul style="line-height:1.6">
        <li><b>Fake UPI "payment successful" screenshots</b> — pressure to ship goods before money lands. Only your bank/UPI app confirms a real credit.</li>
        <li><b>Fake loan / KYC apps</b> — "update KYC" or "instant loan" links that harvest OTPs and card details.</li>
        <li><b>Job & investment "too good" offers</b> — small upfront "fees" or "deposits" that vanish.</li>
      </ul>
      <p>Rule of thumb: if a message creates urgency and asks you to pay, share an OTP, or act now — slow down and verify.</p>
      <p>Read the full breakdowns on our <a href="https://asquaresolution.com/blog/">scam guides</a>.</p>`,
      }
    case 2:
      return {
        subject: WELCOME_STEPS[1].subject,
        title: 'Your 30-second scam check',
        bodyHtml: `
      <p>${hi(name)} got a message or screenshot you're unsure about? ScamCheck gives you an instant risk read — free, no signup:</p>
      <ol style="line-height:1.6">
        <li>Open <a href="https://scamcheck.asquaresolution.com">ScamCheck</a>.</li>
        <li>Paste the suspicious text, or upload the screenshot.</li>
        <li>Get a risk score + why it's flagged, in seconds.</li>
      </ol>
      <p>Try the <a href="https://scamcheck.asquaresolution.com/screenshot-scam-checker">screenshot checker</a> on that "payment successful" image before you ship anything.</p>`,
      }
    case 3:
      return {
        subject: WELCOME_STEPS[2].subject,
        title: 'Beyond scam-checking: TrustSeal + the Lab',
        bodyHtml: `
      <p>${hi(name)} two more things from A Square Solutions worth knowing:</p>
      <ul style="line-height:1.6">
        <li><b>TrustSeal</b> — verify whether a business or website is legitimate before you pay or share details.</li>
        <li><b>AI Execution Lab</b> — if you build things, our <a href="https://lab.asquaresolution.com">Lab</a> shares production AI engineering notes, systems, and post-mortems.</li>
      </ul>
      <p>That's the end of your welcome series — you'll now get our regular practical updates. Reply any time; a real person reads it.</p>`,
      }
    default:
      return null
  }
}

/**
 * Which drip step (1..3) is due now for a subscriber, or null if none. Pure.
 * `sinceMs` is the launch-cutoff (WELCOME_SEQUENCE_SINCE as epoch ms): subscribers
 * created BEFORE it are never enrolled (prevents retro-enrolling pre-launch
 * subscribers). Default 0 = no cutoff (backward compatible).
 */
export function dueWelcomeStep(
  sub: { createdAt?: string; welcomeStep?: number; unsubscribed?: boolean },
  now: number,
  sinceMs = 0,
): number | null {
  if (sub.unsubscribed) return null
  const next = (sub.welcomeStep ?? 0) + 1
  if (next > MAX_WELCOME_STEP) return null
  const def = WELCOME_STEPS.find((s) => s.step === next)
  if (!def) return null
  const created = sub.createdAt ? Date.parse(sub.createdAt) : NaN
  if (isNaN(created)) return null
  // Launch cutoff: only subscribers created at/after the cutoff are eligible.
  if (sinceMs && created < sinceMs) return null
  const ageDays = (now - created) / DAY_MS
  return ageDays >= def.offsetDays ? next : null
}
