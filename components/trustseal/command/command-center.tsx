'use client'
// components/trustseal/command/command-center.tsx  (asq-trustseal-command-phase1)
// Premium "Trust Intelligence Command Center" — Phase-1 VISUAL prototype.
// Dark-futuristic, glassmorphism, holographic panels, depth, animated network.
// Framer Motion + SVG/Canvas only — NO React Three Fiber, NO new deps, MOCK data.
// Self-contained dark palette (does not depend on the --ts-* tokens). Honors
// prefers-reduced-motion. Data wiring + auth gating land in the next phase.
import { motion, useReducedMotion } from 'framer-motion'
import { TrustNetwork } from '@/components/trustseal/command/trust-network'
import { TrustScoreCards, ActivityFeed, RiskPanel, VerificationTimeline, Panel, LiveDot } from '@/components/trustseal/command/widgets'

const C = { text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee', violet: '#a78bfa', good: '#34d399' }

const NAV = [
  { icon: '◎', label: 'Overview', active: true },
  { icon: '◫', label: 'Domains' },
  { icon: '✓', label: 'Verifications' },
  { icon: '⚠', label: 'Risk' },
  { icon: '⬡', label: 'Network' },
  { icon: '◷', label: 'Timeline' },
  { icon: '⚙', label: 'Settings' },
]

function AnimatedBackdrop() {
  const reduce = useReducedMotion()
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base gradient */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(1200px 600px at 70% -10%, rgba(56,189,248,0.10), transparent 60%), radial-gradient(900px 500px at 10% 110%, rgba(139,92,246,0.10), transparent 60%), #060913' }} />
      {/* grid */}
      <div className="absolute inset-0 opacity-[0.5]" style={{
        backgroundImage: 'linear-gradient(rgba(120,160,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,255,0.06) 1px, transparent 1px)',
        backgroundSize: '44px 44px', maskImage: 'radial-gradient(circle at 50% 30%, #000 0%, transparent 75%)', WebkitMaskImage: 'radial-gradient(circle at 50% 30%, #000 0%, transparent 75%)',
      }} />
      {/* drifting aurora */}
      {!reduce && (
        <motion.div className="absolute -top-40 left-1/3 h-[36rem] w-[36rem] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.10), transparent 60%)', filter: 'blur(40px)' }}
          animate={{ x: [0, 80, -40, 0], y: [0, 40, 10, 0] }} transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }} />
      )}
    </div>
  )
}

export function CommandCenter({ locale = 'en' }: { locale?: string }) {
  return (
    <div data-command-center className="relative min-h-screen w-full" style={{ color: C.text1, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <AnimatedBackdrop />

      <div className="relative flex min-h-screen">
        {/* ── 2. Left navigation ── */}
        <nav className="sticky top-0 hidden h-screen w-[68px] shrink-0 flex-col items-center gap-1 border-r py-5 md:flex"
          style={{ borderColor: 'rgba(120,160,255,0.12)', background: 'rgba(8,12,22,0.5)', backdropFilter: 'blur(12px)' }}>
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #22d3ee, #8b5cf6)', color: '#06121e', boxShadow: '0 0 18px rgba(56,189,248,0.5)' }}>TS</div>
          {NAV.map((n) => (
            <button key={n.label} title={n.label} aria-label={n.label} aria-current={n.active ? 'page' : undefined}
              className="group relative flex h-11 w-11 flex-col items-center justify-center rounded-xl text-lg transition-colors"
              style={{ color: n.active ? C.cyan : C.text3, background: n.active ? 'rgba(34,211,238,0.10)' : 'transparent' }}>
              {n.active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full" style={{ background: C.cyan, boxShadow: `0 0 8px ${C.cyan}` }} />}
              <span aria-hidden>{n.icon}</span>
              <span className="text-[8px] tracking-wide">{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ── 3. Top intelligence bar ── */}
          <header className="sticky top-0 z-10 flex items-center gap-4 border-b px-5 py-3"
            style={{ borderColor: 'rgba(120,160,255,0.12)', background: 'rgba(6,9,19,0.7)', backdropFilter: 'blur(14px)' }}>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-wide">Trust Intelligence</h1>
                <span className="rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-widest" style={{ borderColor: 'rgba(34,211,238,0.4)', color: C.cyan }}>COMMAND CENTER</span>
              </div>
              <p className="text-[10px]" style={{ color: C.text3 }}>Owner workspace · {locale.toUpperCase()}</p>
            </div>
            <div className="relative ml-auto hidden max-w-sm flex-1 items-center md:flex">
              <span className="pointer-events-none absolute left-3 text-xs" style={{ color: C.text3 }}>⌕</span>
              <input readOnly placeholder="Search domains, verdicts, events…"
                className="w-full rounded-lg border bg-transparent py-2 pl-8 pr-3 text-xs outline-none"
                style={{ borderColor: 'rgba(120,160,255,0.16)', color: C.text2 }} />
            </div>
            <div className="flex items-center gap-3">
              <LiveDot label="LIVE FEED" />
              <span className="hidden h-5 w-px sm:block" style={{ background: 'rgba(120,160,255,0.18)' }} />
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#8b5cf6,#22d3ee)', color: '#06121e' }}>A</div>
            </div>
          </header>

          {/* ── main grid ── */}
          <main className="flex-1 space-y-4 p-5">
            {/* 4. Trust score overview cards */}
            <TrustScoreCards />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {/* 7. Trust network visualization area (spans 2 cols) */}
              <Panel title="Trust Network" badge={<span className="text-[10px]" style={{ color: C.text3 }}>9 nodes · live</span>} className="xl:col-span-2" style={{ minHeight: 320 }}>
                <div className="h-[300px] w-full">
                  <TrustNetwork />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[10px]" style={{ color: C.text3 }}>
                  {[['verified', '#34d399'], ['established', '#22d3ee'], ['limited', '#a78bfa'], ['caution', '#fbbf24'], ['risk', '#f87171']].map(([l, c]) => (
                    <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c as string }} />{l}</span>
                  ))}
                </div>
              </Panel>

              {/* 5. Domain verification activity feed */}
              <ActivityFeed />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* 6. Risk intelligence panel */}
              <RiskPanel />
              {/* 8. Recent verification timeline */}
              <VerificationTimeline />
            </div>

            <p className="pt-2 text-center text-[10px]" style={{ color: C.text3 }}>
              Phase-1 visual prototype · mock data · no real intelligence wired yet
            </p>
          </main>
        </div>
      </div>
    </div>
  )
}
