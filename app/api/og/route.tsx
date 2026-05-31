import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'

// Keep on Node.js runtime — edge runtime cannot use crypto (required by ImageResponse internals)
export const runtime = 'nodejs'

// Per-URL dynamic render (must read query params), but each unique URL is
// cached at the CDN for a year via Cache-Control (cheap, edge-friendly).
export const dynamic = 'force-dynamic'

const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable' }

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

// Severity → accent for scam OG cards.
const SEVERITY_ACCENT: Record<string, { color: string; glow: string }> = {
  high:     { color: '#f87171', glow: 'rgba(239,68,68,0.22)' },
  critical: { color: '#ef4444', glow: 'rgba(239,68,68,0.30)' },
  medium:   { color: '#fbbf24', glow: 'rgba(245,158,11,0.20)' },
  low:      { color: '#60a5fa', glow: 'rgba(59,130,246,0.18)' },
}

// ─────────────────────────────────────────────────────────────
// Devanagari font (for Hindi subtitles). Fetched once, cached in
// module scope. Fails gracefully → English-only render if unavailable.
// ─────────────────────────────────────────────────────────────
let _devanagari: ArrayBuffer | null | undefined
async function loadDevanagari(): Promise<ArrayBuffer | null> {
  if (_devanagari !== undefined) return _devanagari
  try {
    // Noto Sans Devanagari (woff binary from Google Fonts static host).
    const url = 'https://fonts.gstatic.com/s/notosansdevanagari/v26/TuGoUUFzXI5FBtUq5a8bjKYTZjtRU6Sgv3NaV_SNmI0b8QQCQmHn6B2OHHpimSncE.woff'
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    _devanagari = await res.arrayBuffer()
  } catch {
    _devanagari = null
  }
  return _devanagari
}

// ─────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const title       = searchParams.get('title')       ?? 'AI Execution Lab'
  const section     = searchParams.get('section')     ?? ''     // e.g. "FAILURE"
  const description = searchParams.get('description') ?? ''

  // ── Scam template (Discover/social-optimized) ──────────────────
  if ((searchParams.get('template') ?? '') === 'scam') {
    return scamCard({
      title,
      severity: (searchParams.get('sev') ?? 'high').toLowerCase(),
      place: searchParams.get('place') ?? '',
      verdict: searchParams.get('verdict') ?? '',
      hi: searchParams.get('hi') ?? '',
    })
  }

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
    { width: 1200, height: 630, headers: CACHE_HEADERS }
  )
}

// ─────────────────────────────────────────────────────────────
// Scam OG card — severity-coloured, bilingual, with helpline footer.
// ─────────────────────────────────────────────────────────────
async function scamCard(o: { title: string; severity: string; place: string; verdict: string; hi: string }) {
  const sev = SEVERITY_ACCENT[o.severity] ?? SEVERITY_ACCENT.high
  const displayTitle = o.title.length > 70 ? o.title.slice(0, 68) + '…' : o.title
  const verdict = o.verdict.length > 110 ? o.verdict.slice(0, 108) + '…' : o.verdict

  // Load Devanagari font only if a Hindi line is present. We render the
  // Hindi line ONLY when the font loaded (avoids tofu + the "no fonts"
  // crash from passing an empty fonts array — satori needs its default).
  const devanagari = o.hi ? await loadDevanagari() : null
  const showHi = !!(o.hi && devanagari)
  const imgOptions: ConstructorParameters<typeof ImageResponse>[1] = { width: 1200, height: 630, headers: CACHE_HEADERS }
  if (devanagari) {
    imgOptions.fonts = [{ name: 'Noto Sans Devanagari', data: devanagari, style: 'normal', weight: 700 }]
  }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 68px', background: '#05080f', fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>
        {/* Severity glow */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 520, height: 420, background: `radial-gradient(ellipse at top right, ${sev.glow} 0%, transparent 65%)` }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Top row: brand + severity badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: '#6366f1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: 'white' }}>S</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.14em', textTransform: 'uppercase' }}>ScamCheck</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {o.place && <span style={{ fontSize: 16, color: '#94a3b8' }}>{o.place}</span>}
            <div style={{ display: 'flex', padding: '6px 16px', borderRadius: 999, background: `${sev.color}22`, border: `2px solid ${sev.color}`, fontSize: 16, fontWeight: 800, color: sev.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {`⚠ ${o.severity} risk`}
            </div>
          </div>
        </div>

        {/* Title + verdict + Hindi */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: displayTitle.length > 48 ? 56 : 66, fontWeight: 800, color: '#f8fafc', lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 18, maxWidth: 1050 }}>{displayTitle}</div>
          {verdict && <div style={{ fontSize: 26, color: sev.color, fontWeight: 600, lineHeight: 1.35, maxWidth: 980, marginBottom: o.hi ? 14 : 0 }}>{verdict}</div>}
          {showHi && <div style={{ fontSize: 24, color: '#cbd5e1', lineHeight: 1.4, maxWidth: 980, fontFamily: 'Noto Sans Devanagari' }}>{o.hi}</div>}
        </div>

        {/* Footer: helpline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, color: '#64748b' }}>
          <span style={{ color: '#34d399', fontWeight: 700 }}>Report fraud → 1930</span>
          <span>·</span>
          <span>cybercrime.gov.in</span>
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${sev.color} 0%, transparent 70%)` }} />
      </div>
    ),
    imgOptions,
  )
}
