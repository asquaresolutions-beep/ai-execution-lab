import type { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://scamcheck.asquaresolution.com'
export const metadata: Metadata = {
  title: 'Privacy Policy — ScamCheck',
  description: 'How ScamCheck handles screenshots and data: images are optimized on your device and processed in-request; they are not stored.',
  alternates: { canonical: `${BASE}/privacy-policy` },
}

export default function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-200">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: 3 June 2026</p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>ScamCheck (operated by A Square Solutions) helps you check whether a message or screenshot is a scam. This policy explains what we do with the data you submit.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Screenshots and images</h2>
        <p>Images are optimized in your browser before upload and processed in-request to extract text and detect fraud signals. <strong>We do not store uploaded images.</strong> Only a non-reversible hash and analysis metadata (e.g. detected category, risk score) may be retained to improve detection and prevent abuse.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Text and entities</h2>
        <p>Extracted text and entities (links, phone numbers, UPI IDs) are used to assess the message and to compare it against known scam patterns. Do not upload content you do not wish to be processed for this purpose.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Analytics and abuse prevention</h2>
        <p>We use aggregate analytics and rate limiting (by IP) to keep the service available and to detect abuse. We do not sell personal data.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Third-party processing</h2>
        <p>Analysis runs on Google Cloud (Vertex AI, BigQuery). Data is processed under Google Cloud&apos;s terms. We do not share your data with advertisers.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Contact</h2>
        <p>Questions about privacy: see the <a href="/contact" className="text-sky-400 hover:underline">contact page</a>.</p>
      </div>
    </main>
  )
}
