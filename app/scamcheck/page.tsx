import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AuthButton } from '@/components/auth/auth-button'
import { CreditsDashboard } from '@/components/scamcheck/credits-dashboard'
import { QuickAnalyzer } from '@/components/scamcheck/quick-analyzer'
import { ScreenshotAnalyzer } from '@/components/scamcheck/screenshot-analyzer'
import { TrustStats } from '@/components/scamcheck/trust-stats'
import { TrendingIsland } from '@/components/scam-intel/trending-island'
import { AdSlot } from '@/components/ads/ad-slot'
import { buildMeta } from '@/lib/seo/scamcheck-meta'
import { INTEL_PAGES } from '@/lib/scam-intel/intel-pages'

export const metadata: Metadata = buildMeta({
  path: '/scamcheck',
  title: 'ScamCheck — Free AI Scam Detector | WhatsApp, SMS, UPI & Screenshot Fraud Checker',
  description: 'Free AI scam detector. Scan messages, links, emails, phone numbers, and screenshots for phishing and fraud. WhatsApp, SMS, UPI, banking & investment scam checker — instant, multilingual, mobile-first.',
  keywords: ['scam detector', 'AI scam checker', 'WhatsApp scam', 'SMS scam', 'UPI fraud', 'phishing checker', 'screenshot scam check'],
})

const CATEGORIES = [
  { label: 'WhatsApp scams', href: '/whatsapp-scam-checker', emoji: '💬' },
  { label: 'SMS scams', href: '/sms-scam-checker', emoji: '📱' },
  { label: 'UPI scams', href: '/upi-scam-checker', emoji: '₹' },
  { label: 'Banking scams', href: '/scam-intelligence/fake-sbi-kyc-scam', emoji: '🏦' },
  { label: 'Telegram scams', href: '/scam-intelligence/fake-telegram-investment-scam', emoji: '✈️' },
  { label: 'Investment scams', href: '/scam-intelligence/fake-telegram-investment-scam', emoji: '📈' },
  { label: 'Courier scams', href: '/scam-intelligence/fake-courier-customs-scam', emoji: '📦' },
]
const FAQ = [
  { q: 'Is ScamCheck free?', a: 'Yes. Guests get free daily scans; signing in gives more. Screenshot (AI vision) scans use more credits than text checks.' },
  { q: 'How do I check if a message is a scam?', a: 'Paste the message, link, email, or phone number into the scanner, or upload a screenshot. ScamCheck extracts links/UPI IDs/phone numbers, flags fraud signals, and shows the risk and why.' },
  { q: 'Do you store my screenshots?', a: 'No. Images are optimized on your device and processed in-request; they are not stored.' },
  { q: 'Which scams does it detect?', a: 'WhatsApp/SMS/UPI/banking/Telegram/investment/courier scams, phishing links, brand impersonation (look-alike domains), and OTP-theft traps — in English, Hindi, and Hinglish.' },
]

export default function ScamCheckHome() {
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'ScamCheck', applicationCategory: 'SecurityApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }, description: 'Free AI scam detection for messages, links, emails, phone numbers, and screenshots.', publisher: { '@type': 'Organization', name: 'A Square Solutions' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ]
  return (
    <AuthProvider>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {ld.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}

        {/* 1. Hero */}
        <section className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-sky-500/10 to-transparent p-6 text-center sm:p-10">
          <div className="mb-3 flex justify-center"><CreditsDashboard /></div>
          <h1 className="text-3xl font-bold text-zinc-100 sm:text-4xl">Free AI Scam Detector</h1>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">Scan messages, links, emails, phone numbers, and screenshots for phishing and fraud — instantly, in English, Hindi & Hinglish.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a href="#scanner" className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400">Start free scan</a>
            <AuthButton />
          </div>
        </section>

        {/* 2. Quick Scanner */}
        <section id="scanner" className="mt-8 scroll-mt-20"><QuickAnalyzer /></section>
        <section id="screenshot-analyzer" className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6"><ScreenshotAnalyzer /></section>

        {/* 3. Trust section */}
        <TrustStats />
        <AdSlot id="home-mid" format="horizontal" />

        {/* 4. Common scam categories */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-zinc-100">Common scam categories</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORIES.map((c) => (
              <Link key={c.label} href={c.href} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center hover:border-zinc-600">
                <div className="text-2xl">{c.emoji}</div>
                <div className="mt-1 text-sm text-zinc-200">{c.label}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* 5 + 6. Latest alerts + trending campaigns */}
        <TrendingIsland />
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-zinc-100">Trending scam campaigns</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {INTEL_PAGES.slice(0, 6).map((p) => (
              <li key={p.slug} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 hover:border-zinc-600">
                <Link href={`/scam-intelligence/${p.slug}`}><h3 className="font-medium text-zinc-100">{p.h1}</h3><p className="mt-1 text-xs text-zinc-400">{p.directAnswer.slice(0, 100)}…</p></Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-4 text-sm">
            <Link href="/latest-scams" className="text-sky-400 hover:underline">Latest scams →</Link>
            <Link href="/scam-intelligence" className="text-sky-400 hover:underline">All trending campaigns →</Link>
          </p>
        </section>

        {/* 7. Knowledge hub */}
        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-xl font-semibold text-zinc-100">Scam Intelligence Knowledge Hub</h2>
          <p className="mt-2 text-sm text-zinc-400">Search the scam database, read how each scam works, and learn the red flags to protect yourself and your family.</p>
          <div className="mt-3 flex flex-wrap gap-x-4 text-sm">
            <Link href="/scam-database" className="text-sky-400 hover:underline">Search scam database →</Link>
            <Link href="/how-it-works" className="text-sky-400 hover:underline">How ScamCheck works →</Link>
            <Link href="/methodology" className="text-sky-400 hover:underline">Methodology →</Link>
          </div>
        </section>

        {/* 8. Report a scam CTA */}
        <section className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center">
          <h2 className="text-lg font-semibold text-amber-200">Spotted a scam?</h2>
          <p className="mt-1 text-sm text-zinc-300">Report it to help protect others — and reach the right authority for your country.</p>
          <Link href="/contact" className="mt-3 inline-block rounded-lg border border-amber-500/40 px-5 py-2 text-sm text-amber-200 hover:bg-amber-500/10">Report a scam</Link>
        </section>

        {/* 9. FAQ */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-zinc-100">Frequently asked questions</h2>
          <div className="mt-3 space-y-3">{FAQ.map((f, i) => (<div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"><p className="font-medium text-zinc-100">{f.q}</p><p className="mt-1 text-sm text-zinc-400">{f.a}</p></div>))}</div>
        </section>

        {/* 10. Footer is provided globally by ScamCheckFooter */}
        <AdSlot id="home-footer" format="horizontal" />
      </main>
    </AuthProvider>
  )
}
