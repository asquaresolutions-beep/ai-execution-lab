import type { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://scamcheck.asquaresolution.com'
export const metadata: Metadata = {
  title: 'Contact — ScamCheck',
  description: 'Contact A Square Solutions about ScamCheck. To report fraud, use your national cybercrime agency (e.g. 1930 / cybercrime.gov.in in India).',
  alternates: { canonical: `${BASE}/contact` },
}

export default function Contact() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-200">
      <h1 className="text-2xl font-bold">Contact</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>ScamCheck is built by <strong>A Square Solutions</strong>.</p>
        <p>For product feedback or questions, reach us at <a href="mailto:hello@asquaresolution.com" className="text-sky-400 hover:underline">hello@asquaresolution.com</a>.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Reporting a scam</h2>
        <p>ScamCheck does not file reports on your behalf. To report fraud, contact your national agency — for example, in India call <strong>1930</strong> or report at <a href="https://cybercrime.gov.in" className="text-sky-400 hover:underline" target="_blank" rel="noopener noreferrer">cybercrime.gov.in</a>. See a scam&apos;s page under <a href="/scam-intelligence" className="text-sky-400 hover:underline">Scam Intelligence</a> for country-specific reporting.</p>
        <p>If you have lost money or shared sensitive details, contact your bank immediately.</p>
      </div>
    </main>
  )
}
