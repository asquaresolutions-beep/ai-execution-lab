import { ImageResponse } from 'next/og'

export const size        = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a0a00 0%, #0d1425 100%)',
          borderRadius: 8,
        }}
      >
        {/* Hexagon / brand mark */}
        <div
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f97316',
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 800,
            color: 'white',
            fontFamily: 'serif',
            letterSpacing: '-0.5px',
          }}
        >
          A
        </div>
      </div>
    ),
    { ...size }
  )
}
