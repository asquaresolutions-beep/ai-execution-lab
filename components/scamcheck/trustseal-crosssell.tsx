// ScamCheck → TrustSeal cross-sell (both are A Square Solutions trust products).
export function TrustSealCrossSell({ className = '' }: { className?: string }) {
  return (
    <a
      href="https://trustseal.asquaresolution.com"
      className={`flex items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.06] px-4 py-3 text-sm transition hover:border-indigo-500/50 ${className}`}
    >
      <span className="text-zinc-200">
        <span aria-hidden>✅</span> Also from A Square Solutions: <strong className="text-indigo-300">TrustSeal</strong> — verify any website&apos;s trust &amp; authenticity with AI.
      </span>
      <span className="shrink-0 text-indigo-300">Try TrustSeal →</span>
    </a>
  )
}
