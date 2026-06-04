import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMeta } from '@/lib/seo/scamcheck-meta'

export const metadata: Metadata = buildMeta({ path: '/how-it-works', title: 'How ScamCheck Works — AI Scam Detection Explained', description: 'How ScamCheck detects scams: OCR + entity extraction, brand-impersonation detection, reputation, AI vision for screenshots, and semantic matching against known scam campaigns.' })

const STEPS = [
  ['Read the content', 'For text we parse the message directly; for screenshots we run OCR (with AI vision fallback) to extract the text — including Hindi and Hinglish.'],
  ['Extract entities', 'We pull out links, UPI IDs, phone numbers, amounts, and QR/payment references — the things scams actually use.'],
  ['Check impersonation & reputation', 'Domains and emails are checked for typosquatting, homoglyphs, deceptive subdomains, and look-alikes of real brands; trusted/official entities are recognised.'],
  ['Detect fraud signals', 'Pattern detectors flag urgency, OTP-sharing requests, fake refunds/QR, KYC phishing, reward/job bait, and more — multilingual.'],
  ['Match known campaigns', 'The extracted text is compared against a corpus of known scam campaigns for similar patterns.'],
  ['Calibrated verdict', 'Signals are combined and calibrated (anti over-confidence) into a risk score, a clear verdict, the evidence, and what to do next.'],
]

export default function HowItWorks() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-300">
      <h1 className="text-2xl font-bold text-zinc-100">How ScamCheck Works</h1>
      <p className="mt-3 text-sm">ScamCheck combines deterministic fraud detectors with AI vision and semantic matching to give you an explainable risk assessment in seconds. Here is the pipeline:</p>
      <ol className="mt-5 space-y-4">
        {STEPS.map(([t, d], i) => (
          <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-500 text-xs font-bold text-white">{i + 1}</span>
              <div><div className="font-medium text-zinc-100">{t}</div><p className="mt-1 text-sm text-zinc-400">{d}</p></div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-zinc-400">Privacy-first: images are optimized on your device and processed in-request, not stored. ScamCheck gives automated guidance, not legal/financial advice. Built by A Square Solutions.</p>
      <p className="mt-3 flex flex-wrap gap-x-4 text-sm text-sky-400">
        <Link href="/" className="hover:underline">Try the scanner →</Link>
        <Link href="/methodology" className="hover:underline">Methodology →</Link>
        <Link href="/about" className="hover:underline">About →</Link>
      </p>
    </main>
  )
}
