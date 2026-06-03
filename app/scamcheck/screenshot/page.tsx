import type { Metadata } from 'next'
import { AuthProvider } from '@/components/auth/auth-provider'
import { ScreenshotAnalyzer } from '@/components/scamcheck/screenshot-analyzer'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://scamcheck.asquaresolution.com'

export const metadata: Metadata = {
  title: 'Analyze a Screenshot — ScamCheck',
  description: 'Upload, drag-and-drop, or paste a screenshot of a suspicious message to check it for scam signals instantly.',
  alternates: { canonical: `${BASE}/scamcheck/screenshot` },
}

export default function ScreenshotPage() {
  return (
    <AuthProvider>
      <main className="mx-auto max-w-3xl px-4 py-10" id="screenshot-analyzer">
        <ScreenshotAnalyzer />
      </main>
    </AuthProvider>
  )
}
