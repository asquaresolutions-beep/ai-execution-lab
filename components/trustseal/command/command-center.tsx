'use client'
// components/trustseal/command/command-center.tsx  (asq-trustseal-command-phase2)
// "Trust Intelligence Command Center" — Phase-2 VISUAL prototype.
// Ambitious Palantir / Anduril / Cloudflare-Radar direction: the Trust Network is
// the HERO with a holographic Trust Score core, over an animated cyber-grid with a
// floating intelligence-particle field. Glassmorphism, layered depth, a true
// intel-terminal feed, and a stronger TrustSeal seal/hex identity.
// Framer Motion + SVG/CSS only — NO React Three Fiber, NO new deps, MOCK data.
// Self-contained dark palette. Honors prefers-reduced-motion. Data wiring + auth
// gating land in the next phase.
import { motion, useReducedMotion } from 'framer-motion'
import { HeroNetwork } from '@/components/trustseal/command/hero-network'
import { IntelTerminal } from '@/components/trustseal/command/intel-terminal'
import { TrustScoreCards, RiskPanel, VerificationTimeline, LiveDot } from '@/components/trustseal/command/widgets'

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

// Deterministic floating intelligence-particle field (HTML layer, behind content).
const PARTICLES = Array.from({ length: 34 }, (_, i) => ({
  left: (i * 2.937) % 100, top: (i * 6.131) % 100,
  size: (i % 3) + 1.5, dur: 9 + (i % 7) * 2.2, delay: (i % 11) * 0.7,
  hue: i % 4 === 0 ? 'rgba(167,139,250,0.5)' : 'rgba(56,189,248,0.5)',
}))

function AnimatedBackdrop() {
  const reduce = useReducedMotion()
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base gradient */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(1200px 640px at 70% -12%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(900px 520px at 8% 112%, rgba(139,92,246,0.12), transparent 60%), #050811' }} />

      {/* animated cyber-grid (subtle perspective drift) */}
      <motion.div className="absolute inset-0 opacity-[0.55]" style={{
        backgroundImage: 'linear-gradient(rgba(120,160,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,255,0.07) 1px, transparent 1px)',
        backgroundSize: '46px 46px', maskImage: 'radial-gradient(circle at 50% 24%, #000 0%, transparent 78%)', WebkitMaskImage: 'radial-gradient(circle at 50% 24%, #000 0%, transparent 78%)',
      }} animate={reduce ? undefined : { backgroundPosition: ['0px 0px', '46px 46px'] }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} />

      {/* fine scanline wash for the "radar" feel */}
      <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(120,160,255,0.035) 0px, rgba(120,160,255,0.035) 1px, transparent 1px, transparent 4px)' }} />

      {/* floating intelligence particles */}
      {!reduce && PARTICLES.map((p, i) => (
        <motion.span key={i} className="absolute rounded-full" style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, background: p.hue, boxShadow: `0 0 6px ${p.hue}` }}
          animate={{ y: [0, -26, 0], opacity: [0.15, 0.6, 0.15] }} transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }} />
      ))}

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
          style={{ borderColor: 'rgba(120,160,255,0.12)', background: 'rgba(7,11,21,0.55)', backdropFilter: 'blur(12px)' }}>
          {/* TrustSeal hex/seal mark */}
          <div className="mb-4 grid h-9 w-9 place-items-center" aria-label="TrustSeal">
            <svg viewBox="0 0 40 40" className="h-9 w-9">
              <defs><linearGradient id="nav-seal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
              <polygon points="20,3 34,11 34,29 20,37 6,29 6,11" fill="none" stroke="url(#nav-seal)" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.5))' }} />
              <path d="M14 20 l4 4 l8 -9" fill="none" stroke="url(#nav-seal)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
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
            style={{ borderColor: 'rgba(120,160,255,0.12)', background: 'rgba(5,8,17,0.72)', backdropFilter: 'blur(14px)' }}>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-wide">TrustSeal Intelligence</h1>
                <span className="rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-widest" style={{ borderColor: 'rgba(34,211,238,0.4)', color: C.cyan }}>COMMAND CENTER</span>
              </div>
              <p className="font-mono text-[10px]" style={{ color: C.text3 }}>SEC://owner.workspace · {locale.toUpperCase()} · uplink stable</p>
            </div>
            <div className="relative ml-auto hidden max-w-sm flex-1 items-center md:flex">
              <span className="pointer-events-none absolute left-3 text-xs" style={{ color: C.text3 }}>⌕</span>
              <input readOnly placeholder="Query domains, verdicts, threat signals…"
                className="w-full rounded-lg border bg-transparent py-2 pl-8 pr-3 text-xs outline-none"
                style={{ borderColor: 'rgba(120,160,255,0.16)', color: C.text2 }} />
            </div>
            <div className="flex items-center gap-3">
              <LiveDot label="LIVE FEED" />
              <span className="hidden h-5 w-px sm:block" style={{ background: 'rgba(120,160,255,0.18)' }} />
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#8b5cf6,#22d3ee)', color: '#06121e' }}>A</div>
            </div>
          </header>

          {/* ── main: HERO-centric ── */}
          <main className="flex-1 space-y-4 p-5">
            {/* 1 + 2 + 7. HERO: Trust Network with holographic Trust Score core */}
            <section className="relative grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="relative overflow-hidden rounded-2xl xl:col-span-8"
                style={{ minHeight: 460, background: 'linear-gradient(160deg, rgba(13,20,36,0.6), rgba(6,10,20,0.35))', border: '1px solid rgba(120,160,255,0.16)', boxShadow: '0 30px 80px -50px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03) inset' }}>
                {/* hero header strip */}
                <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.cyan, boxShadow: `0 0 8px ${C.cyan}` }} />
                      <h2 className="text-xs font-semibold tracking-[0.22em]" style={{ color: C.text1 }}>TRUST NETWORK</h2>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px]" style={{ color: C.text3 }}>live topology · 8 monitored · 1 anchored origin</p>
                  </div>
                  <span className="rounded-md border px-2 py-1 font-mono text-[9px] tracking-widest" style={{ borderColor: 'rgba(52,211,153,0.4)', color: C.good }}>● OPERATIONAL</span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center pt-8">
                  <HeroNetwork score={94} band="VERIFIED" />
                </div>
                {/* band legend */}
                <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-3 px-5 py-3 font-mono text-[10px]" style={{ color: C.text3, background: 'linear-gradient(0deg, rgba(6,10,20,0.7), transparent)' }}>
                  {[['verified', '#34d399'], ['established', '#22d3ee'], ['limited', '#a78bfa'], ['caution', '#fbbf24'], ['risk', '#f87171']].map(([l, c]) => (
                    <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c as string }} />{l}</span>
                  ))}
                </div>
              </div>

              {/* 6. intelligence terminal beside the hero. Forced height only at
                  xl (where it matches the hero's height); below xl it stacks and
                  sizes to its content — no empty terminal void. */}
              <div className="xl:col-span-4 xl:min-h-[460px]">
                <IntelTerminal />
              </div>
            </section>

            {/* 4. Trust score overview cards (secondary metrics rail) */}
            <TrustScoreCards />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* 6. Risk intelligence panel */}
              <RiskPanel />
              {/* 8. Recent verification timeline */}
              <VerificationTimeline />
            </div>

            <p className="pt-2 text-center font-mono text-[10px]" style={{ color: C.text3 }}>
              Phase-2 visual prototype · mock data · no real intelligence wired yet
            </p>
          </main>
        </div>
      </div>
    </div>
  )
}
