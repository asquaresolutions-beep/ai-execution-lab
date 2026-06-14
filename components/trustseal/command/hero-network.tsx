'use client'
// components/trustseal/command/hero-network.tsx  (asq-trustseal-command-phase2)
// HERO: the Trust Network as the primary element, with a large HOLOGRAPHIC TRUST
// SCORE core at its centre. One cohesive SVG — orbital rings, band-coloured nodes
// orbiting the core, edges with intelligence particles travelling inward, ambient
// field particles, and a rotating HUD score gauge. Framer Motion + SVG only (no
// R3F, no new deps). All motion is prefers-reduced-motion gated.
import { motion, useReducedMotion } from 'framer-motion'

type Band = 'verified' | 'established' | 'limited' | 'caution' | 'risk'
const BC: Record<Band, string> = { verified: '#34d399', established: '#22d3ee', limited: '#a78bfa', caution: '#fbbf24', risk: '#f87171' }

const W = 760, H = 480, CX = 380, CY = 230, CORE = 78
const polar = (deg: number, dist: number) => ({ x: CX + Math.cos((deg * Math.PI) / 180) * dist, y: CY + Math.sin((deg * Math.PI) / 180) * dist })
// Pointy-top hexagon points at radius R about the core — the TrustSeal seal motif.
const hex = (R: number) => Array.from({ length: 6 }, (_, i) => { const a = ((-90 + 60 * i) * Math.PI) / 180; return `${(CX + R * Math.cos(a)).toFixed(1)},${(CY + R * Math.sin(a)).toFixed(1)}` }).join(' ')

const NODES = [
  { id: 'fastly.dev', deg: -64, dist: 188, r: 11, band: 'verified' as Band },
  { id: 'acme.io', deg: -130, dist: 170, r: 9, band: 'established' as Band },
  { id: 'nova.app', deg: -98, dist: 150, r: 7, band: 'established' as Band },
  { id: 'helio.gg', deg: 176, dist: 200, r: 8, band: 'established' as Band },
  { id: 'mintly.co', deg: 132, dist: 176, r: 8, band: 'limited' as Band },
  { id: 'orbit.sh', deg: -8, dist: 205, r: 8, band: 'limited' as Band },
  { id: 'payquik.net', deg: 56, dist: 184, r: 10, band: 'caution' as Band },
  { id: 'lure-bank.top', deg: 92, dist: 156, r: 7, band: 'risk' as Band },
].map((n) => ({ ...n, ...polar(n.deg, n.dist) }))

const TICKS = Array.from({ length: 60 }, (_, i) => i)
const FIELD = Array.from({ length: 26 }, (_, i) => ({ x: (i * 89) % W, y: (i * 137) % H, r: (i % 3) + 0.6, d: (i % 5) * 0.7 }))

export function HeroNetwork({ score = 94, band = 'VERIFIED' }: { score?: number; band?: string }) {
  const reduce = useReducedMotion()
  const arc = 2 * Math.PI * (CORE - 16) // meter radius nests inside the seal hexagon (inradius ≈ 0.866·CORE)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={`Trust network: holographic trust score ${score} of 100 at the centre, surrounded by domains coloured by trust band`}>
      <defs>
        <radialGradient id="hn-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(34,211,238,0.22)" /><stop offset="70%" stopColor="rgba(34,211,238,0.04)" /><stop offset="100%" stopColor="rgba(34,211,238,0)" /></radialGradient>
        <radialGradient id="hn-field" cx="50%" cy="45%" r="60%"><stop offset="0%" stopColor="rgba(56,189,248,0.10)" /><stop offset="100%" stopColor="rgba(56,189,248,0)" /></radialGradient>
        <linearGradient id="hn-seal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#a78bfa" /></linearGradient>
        <filter id="hn-blur"><feGaussianBlur stdDeviation="3.5" /></filter>
        <filter id="hn-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width={W} height={H} fill="url(#hn-field)" />

      {/* ambient field particles */}
      {!reduce && FIELD.map((p, i) => (
        <motion.circle key={`f${i}`} cx={p.x} cy={p.y} r={p.r} fill="#7fb4ff" opacity={0.25}
          animate={{ y: [p.y, p.y - 18, p.y], opacity: [0.1, 0.4, 0.1] }} transition={{ duration: 5 + p.d, repeat: Infinity, ease: 'easeInOut', delay: p.d }} />
      ))}

      {/* orbital rings */}
      {[120, 168, 214].map((rr, i) => (
        <motion.circle key={`o${i}`} cx={CX} cy={CY} r={rr} fill="none" stroke="rgba(120,160,255,0.10)" strokeWidth="1" strokeDasharray={i === 1 ? '2 8' : undefined}
          style={{ transformOrigin: `${CX}px ${CY}px` }} animate={reduce ? undefined : { rotate: i % 2 ? -360 : 360 }} transition={{ duration: 60 + i * 20, repeat: Infinity, ease: 'linear' }} />
      ))}

      {/* edges + travelling intelligence particles */}
      {NODES.map((n, i) => (
        <g key={`e${n.id}`}>
          <line x1={n.x} y1={n.y} x2={CX} y2={CY} stroke="rgba(120,160,255,0.10)" strokeWidth="1" />
          {!reduce && (
            <motion.line x1={n.x} y1={n.y} x2={CX} y2={CY} stroke={BC[n.band]} strokeWidth="1.3" strokeDasharray="2 12" opacity="0.5"
              animate={{ strokeDashoffset: [0, -28] }} transition={{ duration: 1.4 + (i % 3) * 0.4, repeat: Infinity, ease: 'linear' }} />
          )}
          {!reduce && (
            <motion.circle r="2" fill={BC[n.band]}
              animate={{ cx: [n.x, CX], cy: [n.y, CY], opacity: [0, 1, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeIn', delay: i * 0.3 }} />
          )}
        </g>
      ))}

      {/* nodes (hexagonal seal accent) */}
      {NODES.map((n, i) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.r + 7} fill={BC[n.band]} opacity="0.16" filter="url(#hn-blur)" />
          {!reduce && (
            <motion.circle cx={n.x} cy={n.y} r={n.r} fill="none" stroke={BC[n.band]} strokeWidth="1"
              animate={{ r: [n.r, n.r + 8], opacity: [0.55, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: i * 0.2 }} />
          )}
          <circle cx={n.x} cy={n.y} r={n.r} fill="#0a0e1a" stroke={BC[n.band]} strokeWidth="1.6" />
          <circle cx={n.x} cy={n.y} r={Math.max(2, n.r - 5)} fill={BC[n.band]} />
          {/* label placed radially OUTWARD (above top nodes, below bottom nodes) with
              a dark halo, so labels clear the dense core and the edge lines. */}
          <text x={n.x} y={n.y >= CY ? n.y + n.r + 12 : n.y - n.r - 7} textAnchor="middle" fontSize="9" fill="#aab8d4" fontFamily="ui-monospace, monospace"
            stroke="#070b16" strokeWidth="2.6" paintOrder="stroke" strokeLinejoin="round">{n.id}</text>
        </g>
      ))}

      {/* ── HOLOGRAPHIC TRUST SCORE CORE ── */}
      <circle cx={CX} cy={CY} r={CORE + 34} fill="url(#hn-core)" />
      {/* HUD tick ring */}
      <g>
        {TICKS.map((t) => {
          const a = (t / 60) * 2 * Math.PI, big = t % 5 === 0
          const r1 = CORE + 12, r2 = CORE + (big ? 20 : 16)
          return <line key={t} x1={CX + Math.cos(a) * r1} y1={CY + Math.sin(a) * r1} x2={CX + Math.cos(a) * r2} y2={CY + Math.sin(a) * r2} stroke="rgba(56,189,248,0.4)" strokeWidth={big ? 1.4 : 0.7} />
        })}
      </g>
      {/* rotating scanner */}
      {!reduce && (
        <motion.g style={{ transformOrigin: `${CX}px ${CY}px` }} animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - CORE - 6} stroke="rgba(56,189,248,0.5)" strokeWidth="1.5" />
          <circle cx={CX} cy={CY - CORE - 6} r="2.5" fill="#22d3ee" />
        </motion.g>
      )}
      {/* ── TrustSeal seal medallion: the hexagon IS the identity ── */}
      {/* hex backdrop + gradient seal frame. Bolder stroke + faint cyan tint so the
          seal shape stays legible when the whole hero scales down on mobile. */}
      <polygon points={hex(CORE)} fill="rgba(34,211,238,0.06)" stroke="url(#hn-seal)" strokeWidth="3" strokeLinejoin="round" filter="url(#hn-glow)" />
      {/* counter-rotating inner seal hex (motion) */}
      {!reduce && (
        <motion.polygon points={hex(CORE - 26)} fill="none" stroke="rgba(167,139,250,0.45)" strokeWidth="1" strokeDasharray="3 6" strokeLinejoin="round"
          style={{ transformOrigin: `${CX}px ${CY}px` }} animate={{ rotate: -360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} />
      )}
      {/* score meter — track + animated progress arc, nested inside the seal */}
      <circle cx={CX} cy={CY} r={CORE - 16} fill="none" stroke="rgba(120,160,255,0.16)" strokeWidth="5" />
      <motion.circle cx={CX} cy={CY} r={CORE - 16} fill="none" stroke="url(#hn-seal)" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={arc} transform={`rotate(-90 ${CX} ${CY})`} initial={{ strokeDashoffset: arc }} animate={{ strokeDashoffset: arc * (1 - score / 100) }} transition={{ duration: 1.6, ease: 'easeOut' }}
        style={{ filter: 'drop-shadow(0 0 5px rgba(34,211,238,0.6))' }} />
      {/* verified seal check — echoes the nav seal mark */}
      <path d={`M${CX - 9} ${CY - 34} l5 5 l11 -12`} fill="none" stroke="url(#hn-seal)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" filter="url(#hn-glow)" />
      {/* core readout */}
      <text x={CX} y={CY + 8} textAnchor="middle" fontSize="44" fontWeight="700" fill="#e9f3ff" style={{ letterSpacing: '-1px' }}>{score}</text>
      <text x={CX} y={CY + 26} textAnchor="middle" fontSize="10" fill="#6b7a98" fontFamily="ui-monospace, monospace">/ 100</text>
      <text x={CX} y={CY + 42} textAnchor="middle" fontSize="9" fill="#34d399" fontFamily="ui-monospace, monospace" style={{ letterSpacing: '3px' }}>{band}</text>
    </svg>
  )
}
