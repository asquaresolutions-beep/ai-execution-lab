import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMeta } from '@/lib/seo/scamcheck-meta'

export const metadata: Metadata = buildMeta({
  path: '/privacy-policy',
  title: 'Privacy Policy — ScamCheck',
  description: 'How ScamCheck handles screenshots, text, IP logs, analytics, cookies and Google AdSense. Screenshots are processed in-request and not stored.',
})

const S = ({ h, children }: { h: string; children: React.ReactNode }) => (
  <>
    <h2 className="mt-6 text-lg font-semibold text-zinc-100">{h}</h2>
    <div className="mt-1 space-y-2">{children}</div>
  </>
)

export default function PrivacyPolicy() {
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: 'Privacy Policy — ScamCheck',
    publisher: { '@type': 'Organization', name: 'A Square Solutions', url: 'https://asquaresolution.com' },
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: 4 June 2026 · ScamCheck is a product of A Square Solutions.</p>
      <div className="text-sm leading-relaxed text-zinc-300">
        <p className="mt-4">This policy explains what ScamCheck collects, why, how long we keep it, and your choices. It is specific to ScamCheck and is not the A Square Solutions corporate website policy.</p>

        <S h="Screenshot processing">
          <p>When you upload a screenshot, the image is optimised in your browser, then sent to our server and to our AI/OCR provider (Google Cloud Vertex AI) only to read the text and detect fraud signals for that single request.</p>
        </S>
        <S h="Temporary image handling">
          <p><strong>We do not store your uploaded images.</strong> The image exists only for the duration of the analysis request and is discarded afterwards. We do not build a gallery or profile from your uploads.</p>
        </S>
        <S h="Data retention">
          <p>We may retain non-image analysis metadata (detected category, risk score, a non-reversible content hash, timestamp) to improve detection, measure accuracy, and prevent abuse. Contact/report submissions are retained until the matter is resolved. We retain only what is necessary and for no longer than needed.</p>
        </S>
        <S h="IP logging">
          <p>Your IP address is processed transiently for rate limiting, abuse prevention, and to detect your country so we can show the correct fraud-reporting authority. We do not publish IP addresses or use them to identify you beyond these purposes.</p>
        </S>
        <S h="Analytics">
          <p>With your consent we use privacy-respecting analytics to understand aggregate usage and improve the product. You can decline analytics in the cookie banner; essential functionality still works.</p>
        </S>
        <S h="Cookies & consent">
          <p>We use essential cookies/local storage (your consent choice, sign-in, daily credit counts). Analytics and advertising cookies load only after you accept them. We use Google Consent Mode v2 and you can change your choice any time by clearing site data. See the cookie banner shown on your first visit.</p>
        </S>
        <S h="Advertising (Google AdSense)">
          <p>ScamCheck is free, supported by Google AdSense. Google and its partners may use cookies to serve ads. With advertising consent, ads may be personalised; without it, AdSense serves non-personalised ads only. Manage Google ad settings at <a href="https://adssettings.google.com" className="text-sky-400 hover:underline" rel="noopener nofollow" target="_blank">adssettings.google.com</a>. More: Google&apos;s <a href="https://policies.google.com/technologies/ads" className="text-sky-400 hover:underline" rel="noopener nofollow" target="_blank">advertising policies</a>.</p>
        </S>
        <S h="Fraud reporting & contact submissions">
          <p>When you report a scam or contact us, we process the details you provide (and an optional email) to respond and to improve detection. Don&apos;t include more personal data than necessary. We don&apos;t sell your data.</p>
        </S>
        <S h="Security monitoring">
          <p>We log security-relevant events and apply rate limiting to protect the service and its users. These logs are used only for security and reliability.</p>
        </S>
        <S h="Your rights">
          <p>Depending on your location (incl. EU/UK GDPR), you may have rights to access, correct, or delete your data, and to withdraw consent. Contact us to exercise them.</p>
        </S>
        <S h="Contact">
          <p>Privacy questions: <a href="mailto:contact@asquaresolution.com" className="text-sky-400 hover:underline">contact@asquaresolution.com</a> or the <Link href="/contact" className="text-sky-400 hover:underline">contact page</Link>.</p>
        </S>
        <p className="mt-6 flex flex-wrap gap-x-4 text-sky-400">
          <Link href="/terms" className="hover:underline">Terms →</Link>
          <Link href="/disclaimer" className="hover:underline">Disclaimer →</Link>
          <Link href="/" className="hover:underline">Home →</Link>
        </p>
      </div>
    </main>
  )
}
