import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMeta } from '@/lib/seo/scamcheck-meta'

export const metadata: Metadata = buildMeta({
  path: '/disclaimer',
  title: 'Disclaimer — ScamCheck Limitations',
  description: 'ScamCheck is an automated, AI-assisted scam-detection aid. It cannot guarantee fraud detection: results are probabilistic, can be wrong, and are not professional advice.',
})

const S = ({ h, children }: { h: string; children: React.ReactNode }) => (
  <>
    <h2 className="mt-6 text-lg font-semibold text-zinc-100">{h}</h2>
    <div className="mt-1 space-y-2">{children}</div>
  </>
)

export default function Disclaimer() {
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: 'Disclaimer — ScamCheck',
    publisher: { '@type': 'Organization', name: 'A Square Solutions', url: 'https://asquaresolution.com' },
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h1 className="text-2xl font-bold">Disclaimer</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: 4 June 2026 · ScamCheck is a product of A Square Solutions.</p>
      <div className="text-sm leading-relaxed text-zinc-300">
        <p className="mt-4">Please read this carefully before relying on any ScamCheck result.</p>

        <S h="Scam detection limitations">
          <p>ScamCheck analyses the text, links, and signals it can extract from what you submit. It cannot see context it isn&apos;t given, verify identities, confirm payments, or detect every scam. New and targeted scams may not be recognised. A result is a risk indicator, not a verdict.</p>
        </S>
        <S h="AI-generated analysis limitations">
          <p>Parts of the analysis use AI and automated heuristics. AI can misread images, misinterpret language (including Hindi/Hinglish), and occasionally produce incorrect or incomplete explanations. Treat AI output as a starting point, not a fact.</p>
        </S>
        <S h="No guarantee of fraud detection">
          <p><strong>ScamCheck does not guarantee that it will detect fraud, and a &quot;safe&quot; or low-risk result is not a guarantee that something is legitimate.</strong> Conversely, a high-risk result is not proof of a crime. Always confirm independently through official channels before acting, paying, or sharing information.</p>
        </S>
        <S h="Not professional advice">
          <p>ScamCheck is for education and awareness only and is not legal, financial, or professional advice. If money or sensitive details may be involved, contact your bank and your national fraud authority immediately.</p>
        </S>
        <p className="mt-6 flex flex-wrap gap-x-4 text-sky-400">
          <Link href="/terms" className="hover:underline">Terms →</Link>
          <Link href="/privacy-policy" className="hover:underline">Privacy →</Link>
          <Link href="/contact" className="hover:underline">Report a scam →</Link>
          <Link href="/" className="hover:underline">Home →</Link>
        </p>
      </div>
    </main>
  )
}
