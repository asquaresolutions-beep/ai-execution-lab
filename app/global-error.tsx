'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// Renders when the root layout itself throws.
// Must include its own <html>/<body> since the layout is broken.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[global error]', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#05080f',
          color: '#cbd5e1',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
            Critical error
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
            The application encountered an unrecoverable error.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#f97316',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
