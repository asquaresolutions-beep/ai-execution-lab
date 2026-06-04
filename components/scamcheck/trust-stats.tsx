// components/scamcheck/trust-stats.tsx
// Trust statistics band — capability metrics (not inflated usage counts).
import { INTEL_PAGES } from '@/lib/scam-intel/intel-pages'
import { CHECKERS } from '@/lib/scamcheck/checkers'
import { SUPPORTED_COUNTRIES } from '@/lib/scam-intel/countries'

export function TrustStats() {
  const stats = [
    { v: `${CHECKERS.length}`, l: 'scan channels' },
    { v: `${INTEL_PAGES.length}+`, l: 'scam types detected' },
    { v: `${SUPPORTED_COUNTRIES.length}`, l: 'countries supported' },
    { v: '3', l: 'languages (EN/HI/Hinglish)' },
    { v: '0', l: 'images stored' },
    { v: 'Free', l: 'to use' },
  ]
  return (
    <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {stats.map((s) => (
          <div key={s.l} className="text-center">
            <div className="text-lg font-bold text-zinc-100">{s.v}</div>
            <div className="text-[10px] leading-tight text-zinc-500">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
