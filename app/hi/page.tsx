import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthProvider } from '@/components/auth/auth-provider'
import { QuickAnalyzer } from '@/components/scamcheck/quick-analyzer'
import { ScreenshotAnalyzer } from '@/components/scamcheck/screenshot-analyzer'
import { AdSlot } from '@/components/ads/ad-slot'
import { buildMeta } from '@/lib/seo/scamcheck-meta'
import { HI_CHECKERS, HI_HOME_FAQ } from '@/lib/scamcheck/hi-pages'

export const metadata: Metadata = buildMeta({
  path: '/hi',
  title: 'मुफ़्त AI स्कैम डिटेक्टर — WhatsApp, SMS, लिंक और फ़िशिंग जाँच | ScamCheck',
  description: 'मुफ़्त AI स्कैम डिटेक्टर। संदेश, लिंक, ईमेल, नंबर और स्क्रीनशॉट की फ़िशिंग व धोखाधड़ी जाँच करें। WhatsApp, SMS, UPI और बैंकिंग स्कैम चेकर — तुरंत और मुफ़्त।',
  keywords: ['स्कैम डिटेक्टर', 'स्कैम चेक', 'फ़िशिंग जाँच', 'whatsapp स्कैम', 'लिंक स्कैम चेक', 'क्या यह स्कैम है'],
  languages: { hi: '/hi', en: '/', es: '/es', 'x-default': '/' },
  locale: 'hi_IN',
})

export default function HiHome() {
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'ScamCheck', applicationCategory: 'SecurityApplication', operatingSystem: 'Web', inLanguage: 'hi', offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }, description: 'मुफ़्त AI स्कैम डिटेक्टर — संदेश, लिंक, ईमेल, नंबर और स्क्रीनशॉट के लिए।', publisher: { '@type': 'Organization', name: 'A Square Solutions' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'hi', mainEntity: HI_HOME_FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ]
  return (
    <AuthProvider>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {ld.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}

        <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center sm:p-12">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
          </div>
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300"><span aria-hidden>🛡️</span> AI से · निजता पहले · मुफ़्त</span>
            <h1 className="mt-4 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">मुफ़्त AI स्कैम डिटेक्टर</h1>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">संदेश, लिंक, ईमेल, नंबर और स्क्रीनशॉट की फ़िशिंग व धोखाधड़ी जाँच करें — तुरंत और मुफ़्त।</p>
            <div className="mt-6"><a href="#scanner" className="rounded-xl bg-sky-500 px-7 py-3 font-semibold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-400">मुफ़्त जाँच शुरू करें</a></div>
          </div>
        </section>

        <section id="scanner" className="mt-8 scroll-mt-20"><QuickAnalyzer /></section>
        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6"><ScreenshotAnalyzer defaultLang="hi" /></section>

        <AdSlot id="hi-home-mid" format="horizontal" />

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-zinc-100">चेकर</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {HI_CHECKERS.map((c) => (
              <Link key={c.slug} href={`/hi/${c.slug}`} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center text-sm text-zinc-200 hover:border-zinc-600">{c.h1}</Link>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-zinc-100">अक्सर पूछे जाने वाले प्रश्न</h2>
          <div className="mt-3 space-y-3">{HI_HOME_FAQ.map((f, i) => (<div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"><p className="font-medium text-zinc-100">{f.q}</p><p className="mt-1 text-sm text-zinc-400">{f.a}</p></div>))}</div>
        </section>

        <p className="mt-8 text-center text-sm"><Link href="/" className="text-sky-400 hover:underline">English version →</Link></p>
        <AdSlot id="hi-home-footer" format="horizontal" />
      </main>
    </AuthProvider>
  )
}
