import { ImageResponse } from 'next/og'

// Node.js serverless (not edge) — matches app/opengraph-image.tsx; edge runtime on
// metadata image files can cause Next.js 15 deployment failures on Vercel.
// Div-based layout only (Satori-safe); the TrustSeal seal is represented by the
// cyan→violet check badge (its existing in-product identity), no new logo invented.
export const alt         = 'TrustSeal — Business trust & verification'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '64px 72px',
          background: '#070b16',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 640, height: 320, background: 'radial-gradient(ellipse at top right, rgba(139,92,246,0.18) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 560, height: 300, background: 'radial-gradient(ellipse at bottom left, rgba(34,211,238,0.14) 0%, transparent 60%)' }} />

        {/* Seal badge + brand line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #22d3ee 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              fontWeight: 900,
              color: '#070b16',
            }}
          >
            ✓
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#22d3ee', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              A Square Solutions
            </span>
            <span style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Business trust & verification</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: 82, fontWeight: 800, color: '#f8fafc', lineHeight: 1.05, letterSpacing: '-2px', marginBottom: 20 }}>
          TrustSeal
        </div>

        {/* Description */}
        <div style={{ fontSize: 24, color: '#94a3b8', lineHeight: 1.5, maxWidth: 820 }}>
          Verify a business controls its domain and turn it into a live, checkable trust badge — not a static image anyone can copy.
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: 10, marginTop: 36 }}>
          {['Domain-verified', 'Live badge', 'Explainable score', 'Public Trust API'].map((label) => (
            <div key={label} style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', fontSize: 14, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.03em' }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
