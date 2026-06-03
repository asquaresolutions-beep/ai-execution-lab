import type { Metadata } from 'next'
import Link from 'next/link'
import { ScreenshotAnalyzer } from '@/components/scamcheck/screenshot-analyzer'
import { INTEL_PAGES } from '@/lib/scam-intel/intel-pages'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.asquaresolution.com'

export const metadata: Metadata = {
  title: 'ScamCheck — Screenshot Scam Detector (WhatsApp, SMS, UPI, Banking)',
  description: 'Upload a screenshot of a suspicious WhatsApp, SMS, UPI, or banking message and get an instant AI scam check — extracted links, UPI IDs, phone numbers, fraud signals, and similar known scam campaigns. Free, mobile-first, multilingual.',
  alternates: { canonical: `${BASE}/scamcheck` },
  openGraph: { title: 'ScamCheck — Screenshot Scam Detector', description: 'Paste or upload a screenshot of a suspicious message and get an instant scam check.', url: `${BASE}/scamcheck`, type: 'website' },
}

export default function ScamCheckHome() {
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'ScamCheck', applicationCategory: 'SecurityApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }, description: 'Screenshot-based AI scam detection for WhatsApp, SMS, UPI and banking messages.', url: `${BASE}/scamcheck` },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: 'Can I check a scam by screenshot?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Upload, drag-and-drop, or paste a screenshot of a suspicious SMS, WhatsApp, UPI, or banking message and ScamCheck reads the text, extracts links/UPI IDs/phone numbers, flags fraud signals, and compares it against known scam campaigns.' } },
      { '@type': 'Question', name: 'Is the screenshot stored?', acceptedAnswer: { '@type': 'Answer', text: 'No. Images are optimized on your device and processed securely in-request; only a hash and analysis metadata are kept, not the image.' } },
    ] },
  ]
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {ld.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}
      <ScreenshotAnalyzer />

      <section className="mt-10 text-sm text-zinc-400">
        <h2 className="text-base font-semibold text-zinc-200">How screenshot scam detection works</h2>
        <p className="mt-2">ScamCheck uses on-device image optimization, OCR, and AI vision to read a screenshot, then extracts URLs, UPI IDs, phone numbers, and urgency/impersonation markers. It checks domains for look-alikes and shorteners, classifies the scam type, and retrieves the most similar known scam campaigns from a semantic vector index — so you see not just <em>whether</em> it&apos;s a scam, but <em>why</em>.</p>
        <h2 className="mt-6 text-base font-semibold text-zinc-200">Common scams to check</h2>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {INTEL_PAGES.map((p) => <li key={p.slug}><Link href={`/scam-intelligence/${p.slug}`} className="text-sky-400 hover:underline">{p.h1}</Link></li>)}
        </ul>
        <p className="mt-4"><Link href="/scam-intelligence" className="text-sky-400 hover:underline">See all trending scam campaigns →</Link></p>
      </section>
    </main>
  )
}
