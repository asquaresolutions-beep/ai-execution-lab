import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AuthButton } from '@/components/auth/auth-button'
import { CreditsDashboard } from '@/components/scamcheck/credits-dashboard'
import { QuickAnalyzer } from '@/components/scamcheck/quick-analyzer'
import { ScreenshotAnalyzer } from '@/components/scamcheck/screenshot-analyzer'
import { AdSlot } from '@/components/ads/ad-slot'
import { INTEL_PAGES } from '@/lib/scam-intel/intel-pages'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://scamcheck.asquaresolution.com'

export const metadata: Metadata = {
  title: 'ScamCheck — Free AI Scam Detector | WhatsApp, SMS & UPI Fraud Checker',
  description: 'Free AI scam detector: check a suspicious message, link, email, phone number, or screenshot for phishing and fraud. WhatsApp scam scanner, SMS scam checker, and UPI fraud detection — instant, multilingual, mobile-first.',
  keywords: ['scam detector', 'phishing detection', 'WhatsApp scam scanner', 'SMS scam checker', 'UPI fraud detection', 'fake bank message', 'screenshot scam check'],
  alternates: { canonical: `${BASE}/scamcheck` },
  openGraph: { title: 'ScamCheck — Free AI Scam Detector', description: 'Check a message, link, email, phone, or screenshot for scams instantly.', url: `${BASE}/scamcheck`, type: 'website' },
}

export default function ScamCheckHome() {
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'ScamCheck', applicationCategory: 'SecurityApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }, description: 'AI scam detection for messages, links, emails, phone numbers, UPI IDs, and screenshots.', url: `${BASE}/scamcheck`, publisher: { '@type': 'Organization', name: 'A Square Solutions' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: 'How do I check if a message is a scam?', acceptedAnswer: { '@type': 'Answer', text: 'Paste the message, link, email, phone number, or upload a screenshot into ScamCheck. It extracts links/UPI IDs/phone numbers, flags fraud signals, and tells you the risk and why.' } },
      { '@type': 'Question', name: 'Is ScamCheck free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Guests get free daily scans; signing in gives more. Screenshots (AI vision) use more credits than text checks.' } },
    ] },
  ]
  return (
    <AuthProvider>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {ld.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}

        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">ScamCheck</h1>
            <p className="text-xs text-zinc-500">AI scam detector · by A Square Solutions</p>
          </div>
          <div className="flex items-center gap-3">
            <CreditsDashboard />
            <AuthButton />
          </div>
        </header>

        {/* 1. Quick analyzer (text/link/email/phone) — above the fold */}
        <QuickAnalyzer />

        {/* 2. AI screenshot analyzer — below the quick analyzer */}
        <section id="screenshot-analyzer" className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
          <ScreenshotAnalyzer />
        </section>

        <section className="mt-10 text-sm text-zinc-400">
          <h2 className="text-base font-semibold text-zinc-200">Free scam &amp; phishing detection for any message</h2>
          <p className="mt-2">ScamCheck is a WhatsApp scam scanner, SMS scam checker, and UPI fraud detector in one. Paste a message or link, or upload a screenshot — we read the content, extract links, UPI IDs and phone numbers, check domains for look-alikes, and compare against known scam campaigns so you see whether it&apos;s a scam and why.</p>
          <h2 className="mt-6 text-base font-semibold text-zinc-200">Common scams</h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {INTEL_PAGES.slice(0, 8).map((p) => <li key={p.slug}><Link href={`/scam-intelligence/${p.slug}`} className="text-sky-400 hover:underline">{p.h1}</Link></li>)}
          </ul>
          <p className="mt-4"><Link href="/scam-intelligence" className="text-sky-400 hover:underline">All trending scam campaigns →</Link></p>
        </section>

        {/* Ad slot kept far from the tool / trust UI (page footer). */}
        <AdSlot id="scamcheck-home-footer" format="horizontal" />
      </main>
    </AuthProvider>
  )
}
