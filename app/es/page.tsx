import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthProvider } from '@/components/auth/auth-provider'
import { QuickAnalyzer } from '@/components/scamcheck/quick-analyzer'
import { ScreenshotAnalyzer } from '@/components/scamcheck/screenshot-analyzer'
import { AdSlot } from '@/components/ads/ad-slot'
import { buildMeta } from '@/lib/seo/scamcheck-meta'
import { ES_CHECKERS, ES_HOME_FAQ } from '@/lib/scamcheck/es-pages'

export const metadata: Metadata = buildMeta({
  path: '/es',
  title: 'Detector de Estafas con IA Gratis — WhatsApp, SMS, Enlaces y Phishing | ScamCheck',
  description: 'Detector de estafas con IA gratis. Analiza mensajes, enlaces, correos, números y capturas para detectar phishing y fraude. Para España, México, Argentina, Colombia, Perú y Chile.',
  keywords: ['detector de estafas', 'verificar enlace estafa', 'comprobar mensaje fraude', 'detector de phishing', 'es esto una estafa', 'verificador de estafas whatsapp'],
  languages: { es: '/es', en: '/', 'x-default': '/' },
  locale: 'es_ES',
})

export default function EsHome() {
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'ScamCheck', applicationCategory: 'SecurityApplication', operatingSystem: 'Web', inLanguage: 'es', offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, description: 'Detector de estafas con IA gratis para mensajes, enlaces, correos, números y capturas.', publisher: { '@type': 'Organization', name: 'A Square Solutions' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'es', mainEntity: ES_HOME_FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300"><span aria-hidden>🛡️</span> Con IA · Privacidad primero · Gratis</span>
            <h1 className="mt-4 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">Detector de Estafas con IA</h1>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">Analiza mensajes, enlaces, correos, números y capturas para detectar phishing y fraude — al instante y gratis.</p>
            <div className="mt-6"><a href="#scanner" className="rounded-xl bg-sky-500 px-7 py-3 font-semibold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-400">Analizar gratis</a></div>
          </div>
        </section>

        <section id="scanner" className="mt-8 scroll-mt-20"><QuickAnalyzer /></section>
        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6"><ScreenshotAnalyzer /></section>

        <AdSlot id="es-home-mid" format="horizontal" />

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-zinc-100">Verificadores</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ES_CHECKERS.map((c) => (
              <Link key={c.slug} href={`/es/${c.slug}`} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center text-sm text-zinc-200 hover:border-zinc-600">{c.h1}</Link>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-zinc-100">Preguntas frecuentes</h2>
          <div className="mt-3 space-y-3">{ES_HOME_FAQ.map((f, i) => (<div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"><p className="font-medium text-zinc-100">{f.q}</p><p className="mt-1 text-sm text-zinc-400">{f.a}</p></div>))}</div>
        </section>

        <p className="mt-8 text-center text-sm"><Link href="/" className="text-sky-400 hover:underline">English version →</Link></p>
        <AdSlot id="es-home-footer" format="horizontal" />
      </main>
    </AuthProvider>
  )
}
