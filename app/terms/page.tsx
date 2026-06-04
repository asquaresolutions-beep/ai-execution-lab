import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMeta } from '@/lib/seo/scamcheck-meta'

export const metadata: Metadata = buildMeta({
  path: '/terms',
  title: 'Terms of Use — ScamCheck',
  description: 'ScamCheck provides automated, best-effort, educational scam-risk assessment — not legal or financial advice. Accuracy is limited; verify through official channels.',
})

const S = ({ h, children }: { h: string; children: React.ReactNode }) => (
  <>
    <h2 className="mt-6 text-lg font-semibold text-zinc-100">{h}</h2>
    <div className="mt-1 space-y-2">{children}</div>
  </>
)

export default function Terms() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-200">
      <h1 className="text-2xl font-bold">Terms of Use</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: 4 June 2026 · ScamCheck is a product of A Square Solutions.</p>
      <div className="text-sm leading-relaxed text-zinc-300">
        <p className="mt-4">By using ScamCheck you agree to these terms.</p>

        <S h="No financial advice">
          <p>ScamCheck does not provide financial or investment advice. Nothing here is a recommendation to make, avoid, or reverse any payment or transaction. Decisions about your money are yours.</p>
        </S>
        <S h="No legal advice">
          <p>ScamCheck does not provide legal advice. Output is informational and is not a substitute for a qualified professional.</p>
        </S>
        <S h="Educational use">
          <p>ScamCheck is an educational and awareness tool to help you recognise scams. Use it to inform your own judgement, not as the sole basis for any decision.</p>
        </S>
        <S h="Accuracy limitations">
          <p>Detection is automated and best-effort. It can produce <strong>false positives</strong> (flagging safe content) and <strong>false negatives</strong> (missing real scams). A &quot;low risk&quot; result is never a guarantee of safety. Always verify through official apps, websites, and phone numbers you look up yourself.</p>
        </S>
        <S h="User responsibilities">
          <p>You agree to: use the service lawfully; not upload unlawful content or others&apos; personal data without basis; not abuse, overload, scrape, or attempt to disrupt the service; and independently verify anything important. You are responsible for your own actions and transactions.</p>
        </S>
        <S h="No liability">
          <p>The service is provided &quot;as is&quot; without warranties. To the maximum extent permitted by law, A Square Solutions is not liable for losses arising from use of, or reliance on, ScamCheck. If you suspect fraud, contact your bank and your national fraud authority immediately.</p>
        </S>
        <S h="Changes">
          <p>We may update these terms; continued use constitutes acceptance.</p>
        </S>
        <p className="mt-6 flex flex-wrap gap-x-4 text-sky-400">
          <Link href="/privacy-policy" className="hover:underline">Privacy →</Link>
          <Link href="/disclaimer" className="hover:underline">Disclaimer →</Link>
          <Link href="/" className="hover:underline">Home →</Link>
        </p>
      </div>
    </main>
  )
}
