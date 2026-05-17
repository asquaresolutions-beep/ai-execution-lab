import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'

// Keep on Node.js runtime — edge runtime cannot use crypto (required by ImageResponse internals)
export const runtime = 'nodejs'

export const dynamic = 'force-static'

// ─────────────────────────────────────────────────────────────
// Section accent colours (inline styles — OG uses JSX, not Tailwind)
// ─────────────────────────────────────────────────────────────

const SECTION_ACCENTS: Record<string, { color: string; bg: string; border: string }> = {
  DOCS:     { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)' },
  SYSTEM:   { color: '#c084fc', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)' },
  LAB:      { color: '#4ade80', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)'  },
  CASE:     { color: '#fb923c', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' },
  PLAYBOOK: { color: '#fb923c', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' },
  FAILURE:  { color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)'  },
  LOG:      { color: '#c084fc', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)' },
}

const DEFAULT_ACCENT = { color: '#fb923c', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' }

// ─────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const title       = searchParams.get('title')       ?? 'AI Execution Lab'
  const section     = searchParams.get('section')     ?? ''     // e.g. "FAILURE"
  const description = searchParams.get('description') ?? ''

  const accent = SECTION_ACCENTS[section.toUpperCase()] ?? DEFAULT_ACCENT

  // Truncate title for display
  const displayTitle = title.length > 72 ? title.slice(0, 70) + '…' : title
  const displayDesc  = description.length > 120 ? description.slice(0, 118) + '…' : description

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '60px 72px',
          background: '#05080f',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Dot grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Top-right brand glow */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 500,
            height: 400,
            background: `radial-gradient(ellipse at top right, ${accent.bg.replace('0.12', '0.20')} 0%, transparent 65%)`,
          }}
        />

        {/* Bottom-left subtle glow */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 400,
            height: 300,
            background: 'radial-gradient(ellipse at bottom left, rgba(249,115,22,0.08) 0%, transparent 60%)',
          }}
        />

        {/* Publisher badge top-left */}
        <div
          style={{
            position: 'absolute',
            top: 52,
            left: 72,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: '#f97316',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 900,
              color: 'white',
            }}
          >
            A
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f97316', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              A Square Solutions
            </span>
            <span style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
              AI Execution Lab
            </span>
          </div>
        </div>

        {/* Section badge */}
        {section && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 22,
            }}
          >
            <div
              style={{
                padding: '5px 12px',
                borderRadius: 5,
                background: accent.bg,
                border: `1px solid ${accent.border}`,
                fontSize: 11,
                fontWeight: 700,
                color: accent.color,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              {section}
            </div>
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: displayTitle.length > 50 ? 48 : 58,
            fontWeight: 800,
            color: '#f8fafc',
            lineHeight: 1.15,
            letterSpacing: '-1.5px',
            marginBottom: 18,
            maxWidth: 1000,
          }}
        >
          {displayTitle}
        </div>

        {/* Description */}
        {displayDesc && (
          <div
            style={{
              fontSize: 20,
              color: '#94a3b8',
              lineHeight: 1.5,
              maxWidth: 860,
              marginBottom: 8,
            }}
          >
            {displayDesc}
          </div>
        )}

        {/* Bottom separator */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${accent.color}60 0%, transparent 60%)`,
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
