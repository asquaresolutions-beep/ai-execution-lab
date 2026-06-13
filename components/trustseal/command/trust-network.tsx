'use client'
// components/trustseal/command/trust-network.tsx  (asq-trustseal-command-phase1)
// Animated "trust network" visualization — pure SVG + Framer Motion (no R3F, no
// new deps). Deterministic mock graph: domain nodes coloured by trust band, with
// flowing edges, pulsing nodes, and a radial scan sweep. Honors prefers-reduced-
// motion. Phase-1 prototype: layout/motion only, no real data.
import { motion, useReducedMotion } from 'framer-motion'

type Band = 'verified' | 'established' | 'limited' | 'caution' | 'risk'
const BAND_COLOR: Record<Band, string> = {
  verified: '#34d399', established: '#22d3ee', limited: '#a78bfa', caution: '#fbbf24', risk: '#f87171',
}

interface Node { id: string; x: number; y: number; r: number; band: Band; label: string }
const NODES: Node[] = [
  { id: 'core', x: 300, y: 200, r: 16, band: 'verified', label: 'asquaresolution.com' },
  { id: 'n1', x: 150, y: 110, r: 9, band: 'established', label: 'acme.io' },
  { id: 'n2', x: 470, y: 120, r: 10, band: 'verified', label: 'fastly.dev' },
  { id: 'n3', x: 110, y: 300, r: 8, band: 'limited', label: 'mintly.co' },
  { id: 'n4', x: 480, y: 310, r: 9, band: 'caution', label: 'payquik.net' },
  { id: 'n5', x: 300, y: 60, r: 7, band: 'established', label: 'nova.app' },
  { id: 'n6', x: 250, y: 350, r: 7, band: 'risk', label: 'lure-bank.top' },
  { id: 'n7', x: 560, y: 220, r: 7, band: 'limited', label: 'orbit.sh' },
  { id: 'n8', x: 60, y: 200, r: 6, band: 'established', label: 'helio.gg' },
]
const EDGES: [string, string][] = [
  ['core', 'n1'], ['core', 'n2'], ['core', 'n3'], ['core', 'n4'], ['core', 'n5'],
  ['core', 'n7'], ['n1', 'n8'], ['n3', 'n6'], ['n2', 'n5'], ['n4', 'n7'], ['n1', 'n5'],
]
const byId = (id: string) => NODES.find((n) => n.id === id)!

export function TrustNetwork() {
  const reduce = useReducedMotion()
  return (
    <svg viewBox="0 0 620 400" className="h-full w-full" role="img" aria-label="Trust network: domains linked by verification relationships">
      <defs>
        <radialGradient id="cc-net-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="rgba(34,211,238,0.18)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
        </radialGradient>
        <filter id="cc-node-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect x="0" y="0" width="620" height="400" fill="url(#cc-net-glow)" />

      {/* scan sweep */}
      {!reduce && (
        <motion.circle
          cx="300" cy="200" r="40" fill="none" stroke="rgba(56,189,248,0.35)" strokeWidth="1"
          initial={{ r: 30, opacity: 0.5 }} animate={{ r: 260, opacity: 0 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* edges (flowing dashes) */}
      {EDGES.map(([a, b], i) => {
        const na = byId(a), nb = byId(b)
        return (
          <g key={`${a}-${b}`}>
            <line x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="rgba(120,160,255,0.12)" strokeWidth="1" />
            {!reduce && (
              <motion.line
                x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                stroke={BAND_COLOR[nb.band]} strokeWidth="1.4" strokeDasharray="3 10" opacity="0.55"
                animate={{ strokeDashoffset: [0, -26] }}
                transition={{ duration: 1.6 + (i % 4) * 0.4, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </g>
        )
      })}

      {/* nodes */}
      {NODES.map((n, i) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.r + 6} fill={BAND_COLOR[n.band]} opacity="0.18" filter="url(#cc-node-blur)" />
          {!reduce && (
            <motion.circle
              cx={n.x} cy={n.y} r={n.r} fill="none" stroke={BAND_COLOR[n.band]} strokeWidth="1"
              animate={{ r: [n.r, n.r + 7], opacity: [0.6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: i * 0.25 }}
            />
          )}
          <circle cx={n.x} cy={n.y} r={n.r} fill="#0a0e1a" stroke={BAND_COLOR[n.band]} strokeWidth="1.5" />
          <circle cx={n.x} cy={n.y} r={Math.max(2, n.r - 5)} fill={BAND_COLOR[n.band]} />
          {n.id === 'core' && (
            <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" fontSize="10" fill="#cdd8ec" fontFamily="ui-monospace, monospace">
              {n.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
