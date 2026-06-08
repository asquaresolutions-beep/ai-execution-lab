// components/scamcheck/trust-band.tsx
// asq-trustband-v1 — slim trust band: model credibility (Google Gemini), free,
// privacy, and capability count. Server component, fully static text → zero CLS,
// no client JS, instant render. Reuses the existing chip style (TrustBadges).
// Rollback: delete this file + its <TrustBand/> usages (marked asq-trustband-v1).
import { INTEL_PAGES } from '@/lib/scam-intel/intel-pages'

const CHIPS = [
  { icon: '✨', label: 'Powered by Google Gemini' },
  { icon: '✅', label: '100% free — no sign-up to scan' },
  { icon: '🔒', label: 'Privacy-first — we never store your message' },
  { icon: '🛡️', label: `${INTEL_PAGES.length}+ scam types detected` },
]

export function TrustBand({ className = '' }: { className?: string }) {
  return (
    <ul aria-label="Trust signals" className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {CHIPS.map((c) => (
        <li
          key={c.label}
          className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-300"
        >
          <span aria-hidden>{c.icon}</span>
          {c.label}
        </li>
      ))}
    </ul>
  )
}
