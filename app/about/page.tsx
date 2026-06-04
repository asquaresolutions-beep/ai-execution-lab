import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMeta } from '@/lib/seo/scamcheck-meta'

export const metadata: Metadata = buildMeta({ path: '/about', title: 'About ScamCheck — Free AI Scam Detection by A Square Solutions', description: 'ScamCheck is a free AI scam detection platform by A Square Solutions, helping people in India and worldwide check messages, links, emails, phones, and screenshots for fraud.' })

export default function About() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-zinc-300">
      <h1 className="text-2xl font-bold text-zinc-100">About ScamCheck</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">
        <p>ScamCheck is a free, AI-powered scam-detection platform built and operated by <strong>A Square Solutions</strong>. Online fraud — fake KYC messages, UPI refund traps, courier-fee scams, phishing links, and investment cons — costs people money and trust every day. ScamCheck gives anyone an instant, explainable second opinion before they click, pay, or share details.</p>
        <p>You can check a suspicious message, link, email, phone number, or screenshot. ScamCheck extracts the entities (URLs, UPI IDs, phone numbers), checks domains for look-alikes and impersonation, classifies the scam type, and compares it against known scam campaigns. The interface is available in English, Hindi, and Spanish.</p>
        <p>We are privacy-first: screenshots are optimized on your device and processed in-request, not stored. ScamCheck provides automated risk assessment and educational guidance; it is not legal or financial advice.</p>
        <h2 className="pt-2 text-lg font-semibold text-zinc-100">Built by A Square Solutions</h2>
        <p>A Square Solutions builds practical AI and security products. ScamCheck is part of that mission — making fraud detection accessible to everyone, for free.</p>
        <p className="flex flex-wrap gap-x-4 pt-2 text-sky-400">
          <Link href="/how-it-works" className="hover:underline">How it works →</Link>
          <Link href="/methodology" className="hover:underline">Methodology →</Link>
          <Link href="/contact" className="hover:underline">Contact →</Link>
        </p>
      </div>
    </main>
  )
}
