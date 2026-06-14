'use client'
// components/trustseal/command/intel-terminal.tsx  (asq-trustseal-command-phase2)
// Intelligence-terminal styled verification feed — monospace, status codes, a
// scanline overlay and a blinking cursor, so it reads like a live intel stream
// rather than a generic activity list. Framer Motion + CSS only, MOCK data.
import { motion, useReducedMotion } from 'framer-motion'

const C = { good: '#34d399', cyan: '#22d3ee', violet: '#a78bfa', warn: '#fbbf24', bad: '#f87171', dim: '#5d6a86' }
type Row = { t: string; tag: string; code: string; d: string; msg: string; tone: string }
const ROWS: Row[] = [
  { t: '14:22:07', tag: 'VRFY', code: '200', d: 'asquaresolution.com', msg: 'dns.txt match · score 94', tone: C.good },
  { t: '14:21:48', tag: 'TLS ', code: '298', d: 'payquik.net', msg: 'chain anomaly · review', tone: C.warn },
  { t: '14:20:11', tag: 'CLAIM', code: '102', d: 'nova.app', msg: 'ownership challenge issued', tone: C.cyan },
  { t: '14:18:55', tag: 'INTEL', code: '451', d: 'lure-bank.top', msg: 'blocklist hit · rejected', tone: C.bad },
  { t: '14:16:30', tag: 'VRFY', code: '200', d: 'helio.gg', msg: 're-verification ok', tone: C.good },
  { t: '14:14:02', tag: 'SCORE', code: '200', d: 'orbit.sh', msg: 'verdict recomputed · 71', tone: C.violet },
  { t: '14:11:39', tag: 'VRFY', code: '200', d: 'fastly.dev', msg: 'spf+dmarc verified', tone: C.good },
]

export function IntelTerminal() {
  const reduce = useReducedMotion()
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl"
      style={{ background: 'linear-gradient(160deg, rgba(8,14,26,0.85), rgba(6,10,20,0.7))', border: '1px solid rgba(56,189,248,0.18)', boxShadow: '0 20px 50px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03) inset' }}>
      {/* scanline overlay */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(56,189,248,0.045) 0px, rgba(56,189,248,0.045) 1px, transparent 1px, transparent 3px)' }} />
      <header className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'rgba(56,189,248,0.16)' }}>
        <span className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: '#f87171' }} />
          <span className="h-2 w-2 rounded-full" style={{ background: '#fbbf24' }} />
          <span className="h-2 w-2 rounded-full" style={{ background: '#34d399' }} />
        </span>
        <span className="min-w-0 truncate font-mono text-[10px] tracking-[0.2em]" style={{ color: C.cyan }}>INTEL://verification.stream</span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 font-mono text-[9px] tracking-wider" style={{ color: C.good }}>
          <motion.span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.good, boxShadow: `0 0 6px ${C.good}` }}
            animate={reduce ? undefined : { opacity: [1, 0.2, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
          STREAMING
        </span>
      </header>
      <div className="relative flex-1 space-y-1 overflow-hidden px-3 py-2 font-mono text-[11px] leading-relaxed">
        {/* Rows wrap instead of clipping: time/tag/code/domain flow inline and the
            message falls to a second line on narrow viewports, so every row stays
            fully readable on mobile with no horizontal overflow. */}
        {ROWS.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }} className="flex flex-wrap items-baseline gap-x-2">
            <span style={{ color: C.dim }}>{r.t}</span>
            <span className="rounded px-1" style={{ color: r.tone, background: `${r.tone}14` }}>{r.tag.trim()}</span>
            <span style={{ color: r.tone }}>{r.code}</span>
            <span className="break-all" style={{ color: '#cdd8ec' }}>{r.d}</span>
            <span className="min-w-0 break-words" style={{ color: C.dim }}>{r.msg}</span>
          </motion.div>
        ))}
        <div className="flex items-center gap-1.5 pt-0.5" style={{ color: C.cyan }}>
          <span style={{ color: C.dim }}>{'>'}</span>
          <motion.span className="inline-block h-3 w-1.5" style={{ background: C.cyan }}
            animate={reduce ? undefined : { opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity, ease: 'steps(1)' }} />
        </div>
      </div>
    </div>
  )
}
