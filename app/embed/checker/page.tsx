import type { Metadata } from 'next'
import { AuthProvider } from '@/components/auth/auth-provider'
import { ScreenshotAnalyzer } from '@/components/scamcheck/screenshot-analyzer'

// Embeddable ScamCheck screenshot checker — purpose-built for inline <iframe> use
// inside A Square blog articles (see next.config.mjs: /embed/* permits framing by
// asquaresolution.com only). Chrome-free (SiteChrome skips the 'embed' segment),
// noindex (app/embed/layout.tsx). Uses the SAME rate-limited /api/scam-intel/screenshot
// backend as the production checker — no new abuse surface; the per-IP/day quota
// already gates it. Attribution: ?src=<page-slug> flows into scan_start/scan_complete
// as `embed_source` so GA4 shows which article drove each scan.

export const metadata: Metadata = {
  title: 'Check a payment screenshot — ScamCheck',
  robots: { index: false, follow: false },
}

// Static-neutral: the src is read from the URL client-side is unnecessary; Next gives
// searchParams to the server component. Keep it a plain string.
export default async function EmbedCheckerPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>
}) {
  const { src } = await searchParams
  // Sanitize: short slug-ish token only (defensive; avoids arbitrary strings in events).
  const source = typeof src === 'string' ? src.slice(0, 64).replace(/[^a-zA-Z0-9._/-]/g, '') : undefined

  return (
    <AuthProvider>
      <main className="mx-auto max-w-2xl px-3 py-4" id="scamcheck-embed">
        <ScreenshotAnalyzer source={source || 'embed'} />
        <p className="mt-4 text-center text-[11px] text-zinc-500">
          Free check by{' '}
          <a
            href="https://scamcheck.asquaresolution.com/screenshot-scam-checker"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-300"
          >
            ScamCheck
          </a>{' '}
          · images are processed in-request and not stored
        </p>
      </main>
    </AuthProvider>
  )
}
