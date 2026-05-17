import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 — Page Not Found',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      {/* Code */}
      <p className="text-[80px] sm:text-[120px] font-black font-mono leading-none text-surface-900 select-none">
        404
      </p>

      {/* Brand accent */}
      <div className="w-12 h-0.5 bg-brand-500/60 rounded-full my-6" />

      <h1 className="text-xl sm:text-2xl font-semibold text-surface-100 tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 text-sm text-surface-500 max-w-md leading-relaxed">
        This route doesn&apos;t exist or the content may have been moved.
        Check the URL or head back to the lab.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
          ← Back to Lab
        </Link>
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2 text-sm font-medium text-surface-300 hover:text-surface-100 hover:border-white/[0.16] transition-colors"
        >
          Browse Docs
        </Link>
      </div>
    </div>
  )
}
