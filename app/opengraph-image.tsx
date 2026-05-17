import { ImageResponse } from 'next/og'

// No edge runtime — Node.js serverless is stable on Vercel and ImageResponse
// works identically. Edge runtime on metadata image files can cause deployment
// failures in Next.js 15 due to how Vercel handles the edge function step.
export const alt         = 'AI Execution Lab — A Square Solutions'
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
          background: '#05080f',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Dot grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Brand glow */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 600,
            height: 300,
            background:
              'radial-gradient(ellipse at top left, rgba(249,115,22,0.15) 0%, transparent 60%)',
          }}
        />

        {/* Logo badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              background: '#f97316',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 900,
              color: 'white',
            }}
          >
            A
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#f97316',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              A Square Solutions
            </span>
            <span style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
              AI Operations
            </span>
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: '#f8fafc',
            lineHeight: 1.1,
            letterSpacing: '-2px',
            marginBottom: 20,
          }}
        >
          AI Execution Lab
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 22,
            color: '#94a3b8',
            lineHeight: 1.5,
            maxWidth: 760,
          }}
        >
          Real workflows, real systems, real results — documented while
          building production AI tools and GEO strategies.
        </div>

        {/* Section pills */}
        <div style={{ display: 'flex', gap: 10, marginTop: 36 }}>
          {['Docs', 'Systems', 'Labs', 'Case Studies', 'Playbooks'].map(
            (label) => (
              <div
                key={label}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#64748b',
                  letterSpacing: '0.04em',
                }}
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  )
}
