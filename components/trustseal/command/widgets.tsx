'use client'
// components/trustseal/command/widgets.tsx  (asq-trustseal-command-phase1)
// Command-center panels: trust-score cards, verification activity feed, risk
// intelligence, recent-verification timeline. Framer Motion + SVG only, MOCK data
// (Phase-1 visual prototype — no real wiring yet). Reduced-motion aware.
import { motion, useReducedMotion } from 'framer-motion'

const C = {
  good: '#34d399', cyan: '#22d3ee', violet: '#a78bfa', warn: '#fbbf24', bad: '#f87171',
  text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', line: 'rgba(120,160,255,0.12)',
}
const glass: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
  border: '1px solid rgba(120,160,255,0.14)',
  backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 50px -30px rgba(0,0,0,0.9)',
}

// Small pointy-top seal hexagon — the shared TrustSeal motif that ties every
// lower-dashboard panel to the hero's holographic seal core.
function HexBadge({ color = C.cyan, size = 12, fill = false }: { color?: string; size?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill={fill ? `${color}22` : 'none'} stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function Panel({ title, badge, children, className = '', style }: { title?: string; badge?: React.ReactNode; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-2xl p-4 ${className}`} style={{ ...glass, ...style }}
    >
      {/* top hairline glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)' }} />
      {title && (
        <header className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: C.text2 }}>
            <HexBadge color={C.cyan} size={11} /> {title}
          </h3>
          {badge}
        </header>
      )}
      {children}
    </motion.section>
  )
}

export function LiveDot({ label = 'SAMPLE' }: { label?: string }) {
  const reduce = useReducedMotion()
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider" style={{ color: C.good }}>
      <motion.span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.good, boxShadow: `0 0 8px ${C.good}` }}
        animate={reduce ? undefined : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
      {label}
    </span>
  )
}

// ── Operational readouts ─────────────────────────────────────────
// NOTE: the Trust Score is presented ONCE — in the hero holographic seal core.
// This rail intentionally carries only operational metrics (no competing score).
const METRICS = [
  { k: 'Monitored', v: '142', unit: 'domains', delta: '+6', color: C.cyan, spark: [120, 124, 126, 128, 132, 134, 136, 138, 139, 141, 142] },
  { k: 'Verified', v: '128', unit: 'seals', delta: '+12', color: C.good, spark: [90, 96, 100, 104, 108, 112, 118, 120, 124, 126, 128] },
  { k: 'Active Claims', v: '17', unit: 'pending', delta: '+5', color: C.violet, spark: [8, 10, 9, 12, 14, 13, 15, 14, 16, 15, 17] },
  { k: 'Risk Events', v: '3', unit: '24h', delta: '−1', color: C.warn, spark: [7, 6, 8, 5, 6, 4, 5, 4, 4, 3, 3] },
]
function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data), min = Math.min(...data), w = 96, h = 28
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / (max - min || 1)) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <motion.polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round"
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1 }} />
      <polyline points={`${pts} ${w},${h} 0,${h}`} fill={color} opacity="0.08" />
    </svg>
  )
}
// Kept the export name for stable imports; this rail now renders ops readouts in
// the hero's intelligence aesthetic (mono labels, corner seal hex, colored hairline).
export function TrustScoreCards() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {METRICS.map((m, i) => (
        <motion.div key={m.k} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -4 }} className="relative overflow-hidden rounded-2xl p-4" style={glass}>
          {/* colored top hairline — echoes the panel/terminal headers */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${m.color}99, transparent)` }} />
          {/* corner seal hex */}
          <div className="absolute right-3 top-3 opacity-80"><HexBadge color={m.color} size={16} fill /></div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: C.text3 }}>{m.k}</p>
          <div className="mt-1 flex items-end gap-1">
            <span className="text-3xl font-bold tabular-nums" style={{ color: C.text1 }}>{m.v}</span>
            <span className="mb-1 font-mono text-[10px]" style={{ color: C.text3 }}>{m.unit}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold" style={{ color: m.color, background: `${m.color}1a` }}>{m.delta}</span>
            <Spark data={m.spark} color={m.color} />
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ── 5. Domain verification activity feed ─────────────────────────
// SAMPLE feed — illustrative placeholders only, NOT real verification activity.
const FEED = [
  { d: 'example.com', a: 'DNS verified', t: '12s', tone: C.good },
  { d: 'shop.example', a: 'TLS warning', t: '48s', tone: C.warn },
  { d: 'store.example', a: 'Claim started', t: '2m', tone: C.cyan },
  { d: 'bad-actor.example', a: 'Blocklist hit', t: '5m', tone: C.bad },
  { d: 'pay.example', a: 'Re-verified', t: '8m', tone: C.good },
  { d: 'app.example', a: 'Score updated', t: '11m', tone: C.violet },
]
export function ActivityFeed() {
  return (
    <Panel title="Verification Activity" badge={<LiveDot />} className="h-full">
      <ul className="space-y-1.5">
        {FEED.map((f, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: f.tone, boxShadow: `0 0 6px ${f.tone}` }} />
            <span className="flex-1 truncate font-mono text-xs" style={{ color: C.text1 }}>{f.d}</span>
            <span className="text-[11px]" style={{ color: f.tone }}>{f.a}</span>
            <span className="w-8 text-right text-[10px] tabular-nums" style={{ color: C.text3 }}>{f.t}</span>
          </motion.li>
        ))}
      </ul>
    </Panel>
  )
}

// ── 6. Risk intelligence panel ───────────────────────────────────
function RiskGauge({ value }: { value: number }) {
  const r = 46, c = Math.PI * r, off = c * (1 - value / 100)
  return (
    <svg viewBox="0 0 120 70" className="w-full">
      <path d="M14 60 A46 46 0 0 1 106 60" fill="none" stroke="rgba(120,160,255,0.14)" strokeWidth="9" strokeLinecap="round" />
      <motion.path d="M14 60 A46 46 0 0 1 106 60" fill="none" stroke={value > 60 ? C.bad : value > 30 ? C.warn : C.good}
        strokeWidth="9" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: off }}
        viewport={{ once: true }} transition={{ duration: 1.2, ease: 'easeOut' }} />
      <text x="60" y="54" textAnchor="middle" fontSize="20" fontWeight="700" fill={C.text1}>{value}</text>
      <text x="60" y="66" textAnchor="middle" fontSize="7" fill={C.text3} letterSpacing="1.5">RISK INDEX</text>
    </svg>
  )
}
const THREATS = [
  { l: 'Blocklist matches', n: 2, tone: C.bad }, { l: 'TLS anomalies', n: 4, tone: C.warn },
  { l: 'Impersonation flags', n: 1, tone: C.bad }, { l: 'Stale verdicts', n: 6, tone: C.violet },
]
export function RiskPanel() {
  return (
    <Panel title="Risk Intelligence" badge={<span className="text-[10px]" style={{ color: C.text3 }}>24h window</span>} className="h-full">
      <RiskGauge value={28} />
      <ul className="mt-3 space-y-2">
        {THREATS.map((t) => (
          <li key={t.l} className="flex items-center justify-between">
            <span className="font-mono text-[11px]" style={{ color: C.text2 }}>{t.l}</span>
            <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums" style={{ color: t.tone, background: `${t.tone}1a` }}>{String(t.n).padStart(2, '0')}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// ── 8. Recent verification timeline ──────────────────────────────
// SAMPLE timeline — illustrative placeholders only, NOT real verifications.
const TIMELINE = [
  { t: '14:22', d: 'example.com', s: 'Verified · sample', tone: C.good },
  { t: '13:58', d: 'shop.example', s: 'DNS TXT confirmed', tone: C.cyan },
  { t: '13:30', d: 'store.example', s: 'Flagged for review', tone: C.warn },
  { t: '12:47', d: 'bad-actor.example', s: 'Blocklist — rejected', tone: C.bad },
  { t: '12:05', d: 'pay.example', s: 'Ownership claimed', tone: C.violet },
]
export function VerificationTimeline() {
  return (
    <Panel title="Recent Verifications" className="h-full">
      <ol className="relative ml-1">
        <div className="absolute bottom-1 left-[5px] top-1 w-px" style={{ background: C.line }} />
        {TIMELINE.map((e, i) => (
          <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}
            className="relative mb-3 pl-5 last:mb-0">
            <span className="absolute left-[-1px] top-0.5" aria-hidden style={{ filter: `drop-shadow(0 0 5px ${e.tone}66)` }}>
              <svg width="13" height="13" viewBox="0 0 24 24"><polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill="#0a0e1a" stroke={e.tone} strokeWidth="2.4" strokeLinejoin="round" /></svg>
            </span>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs" style={{ color: C.text1 }}>{e.d}</span>
              <span className="text-[10px] tabular-nums" style={{ color: C.text3 }}>{e.t}</span>
            </div>
            <p className="text-[11px]" style={{ color: e.tone }}>{e.s}</p>
          </motion.li>
        ))}
      </ol>
    </Panel>
  )
}
