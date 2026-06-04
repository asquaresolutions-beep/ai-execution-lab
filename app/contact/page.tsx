import type { Metadata } from 'next'
import { buildMeta } from '@/lib/seo/scamcheck-meta'
import { ContactForm } from '@/components/scamcheck/contact-form'
import { CountryReporting } from '@/components/scamcheck/country-reporting'

export const metadata: Metadata = buildMeta({
  path: '/contact',
  title: 'Contact & Report a Scam — ScamCheck',
  description: 'Contact ScamCheck (by A Square Solutions) or report a scam. Reach us at contact@asquaresolution.com. For fraud, also report to your national agency (e.g. 1930 / cybercrime.gov.in in India).',
})

export default function Contact() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-200">
      <h1 className="text-2xl font-bold">Contact &amp; Report a Scam</h1>
      <p className="mt-2 text-sm text-zinc-400">ScamCheck is built by <strong>A Square Solutions</strong>. Send feedback, a question, or report a scam below. We read every message.</p>
      <div className="mt-6"><ContactForm /></div>
      <section className="mt-8">
        <CountryReporting />
        <p className="mt-3 text-sm text-zinc-400">Email: <a href="mailto:contact@asquaresolution.com" className="text-sky-400 hover:underline">contact@asquaresolution.com</a></p>
      </section>
    </main>
  )
}
