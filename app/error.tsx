'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error:  Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to an error reporting service in production
    console.error('[page error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      {/* Icon */}
      <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>

      <h2 className="text-lg font-semibold text-surface-100 tracking-tight">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-surface-500 max-w-sm leading-relaxed">
        An unexpected error occurred while rendering this page.
        {error.digest && (
          <span className="block mt-1 text-xs font-mono text-surface-700">
            Error ID: {error.digest}
          </span>
        )}
      </p>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2 text-sm font-medium text-surface-300 hover:text-surface-100 transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  )
}
