import type { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://scamcheck.asquaresolution.com'
export const metadata: Metadata = {
  title: 'Terms of Use — ScamCheck',
  description: 'ScamCheck provides automated, best-effort scam risk assessment. It is informational and not legal or financial advice.',
  alternates: { canonical: `${BASE}/terms` },
}

export default function Terms() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-200">
      <h1 className="text-2xl font-bold">Terms of Use</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: 3 June 2026</p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>By using ScamCheck (operated by A Square Solutions) you agree to these terms.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Informational only</h2>
        <p>ScamCheck gives an automated, best-effort risk assessment. It is <strong>not legal, financial, or professional advice</strong> and can produce false positives and false negatives. Always use your own judgement and verify through official channels.</p>
        <h2 className="text-lg font-semibold text-zinc-100">No liability</h2>
        <p>The service is provided &quot;as is&quot; without warranties. A Square Solutions is not liable for losses arising from reliance on its output. If you suspect fraud, contact your bank and your national fraud agency immediately.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Acceptable use</h2>
        <p>Do not abuse, overload, or attempt to disrupt the service, and do not upload unlawful content. We rate-limit and may block abusive usage.</p>
        <h2 className="text-lg font-semibold text-zinc-100">Changes</h2>
        <p>We may update these terms; continued use constitutes acceptance.</p>
      </div>
    </main>
  )
}
