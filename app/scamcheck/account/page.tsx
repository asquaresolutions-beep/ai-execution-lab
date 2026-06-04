import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthProvider } from '@/components/auth/auth-provider'
import { AuthButton } from '@/components/auth/auth-button'
import { AccountDashboard } from '@/components/scamcheck/account-dashboard'
import { buildMeta } from '@/lib/seo/scamcheck-meta'

export const metadata: Metadata = { ...buildMeta({ path: '/scamcheck/account', title: 'My Dashboard — ScamCheck', description: 'Your ScamCheck scan history, risk trends, saved reports, and remaining daily credits.' }), robots: { index: false } }

export default function AccountPage() {
  return (
    <AuthProvider>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">My Dashboard</h1>
            <p className="text-xs text-zinc-500"><Link href="/" className="hover:underline">← Back to ScamCheck</Link></p>
          </div>
          <AuthButton />
        </header>
        <AccountDashboard />
      </main>
    </AuthProvider>
  )
}
