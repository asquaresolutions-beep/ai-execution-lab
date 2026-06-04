import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMeta } from '@/lib/seo/scamcheck-meta'

export const metadata: Metadata = buildMeta({ path: '/methodology', title: 'ScamCheck Methodology — How We Score Scam Risk', description: 'ScamCheck methodology: how risk scores, confidence calibration, brand-impersonation detection, and known-scam matching work — and the limits of automated detection.' })

export default function Methodology() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-300">
      <h1 className="text-2xl font-bold text-zinc-100">Methodology</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold text-zinc-100">Risk scoring</h2>
        <p>Each scan produces a 0–100 risk score from weighted fraud signals (high-severity signals such as OTP-sharing requests, fake-payment/QR, and suspicious links weigh more than warnings), entity risk (link shorteners, UPI handles, phone numbers), and brand-impersonation findings.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Confidence calibration</h2>
        <p>We deliberately avoid over-confidence: a strong claim on thin evidence is pulled toward neutral and its confidence reduced; corroborating evidence (multiple independent signals, a match to a known scam campaign, deep AI-vision agreement) raises confidence. Low-text inputs fall back to a “needs review” state.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Brand impersonation</h2>
        <p>Domains and emails are tested for typosquatting (edit distance), homoglyph/punycode attacks, separator insertion, wrong-TLD clones, and deceptive subdomains against a watched brand list. Verified first-party and official domains are recognised and not flagged unless strong fraud signals are present.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Known-scam matching</h2>
        <p>Extracted text is embedded and compared (vector similarity) against a corpus of known scam campaigns, so a new message can be linked to an existing pattern with a confidence band.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Limits</h2>
        <p>ScamCheck is automated and can produce false positives and false negatives. It is decision support, not a guarantee. Always verify through official channels, and never share OTPs, PINs, or passwords. This is not legal or financial advice. Built by A Square Solutions.</p>
        <p className="flex flex-wrap gap-x-4 pt-2 text-sky-400">
          <Link href="/how-it-works" className="hover:underline">How it works →</Link>
          <Link href="/" className="hover:underline">Try the scanner →</Link>
          <Link href="/privacy-policy" className="hover:underline">Privacy →</Link>
        </p>
      </div>
    </main>
  )
}
