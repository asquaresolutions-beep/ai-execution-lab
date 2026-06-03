// components/scamcheck/trust-signals.tsx
// Trust signals: A Square Solutions verification badge, privacy-first notice,
// and accuracy disclaimer. Server component (no client JS). (Trust Signals)
import Link from 'next/link'

export function TrustSignals() {
  return (
    <section className="mt-8 grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
        <div className="flex items-center gap-1.5 font-medium text-emerald-300">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
          Verified by A Square Solutions
        </div>
        <p className="mt-1 text-xs text-zinc-400">Built and operated by A Square Solutions.</p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
        <div className="font-medium text-zinc-200">🔒 Privacy-first</div>
        <p className="mt-1 text-xs text-zinc-400">Screenshots are optimized on your device and processed in-request — not stored.</p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
        <div className="font-medium text-zinc-200">Accuracy</div>
        <p className="mt-1 text-xs text-zinc-400">Automated risk assessment, not legal/financial advice. <Link href="/contact" className="text-sky-400 hover:underline">Report a scam</Link>.</p>
      </div>
    </section>
  )
}
