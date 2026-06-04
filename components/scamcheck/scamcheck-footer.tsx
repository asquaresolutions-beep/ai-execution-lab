// ScamCheck product footer (server component).
import Link from 'next/link'
import { AdSlot } from '@/components/ads/ad-slot'

export function ScamCheckFooter() {
  return (
    <footer className="mt-12 border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <AdSlot id="footer-multiplex" format="multiplex" />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-zinc-400">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <div className="font-semibold text-zinc-100">ScamCheck</div>
            <p className="mt-1 text-xs text-zinc-500">Free AI scam detection for messages, links, emails, phones, and screenshots. By A Square Solutions.</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Checkers</div>
            <ul className="mt-2 space-y-1 text-xs">
              <li><Link href="/whatsapp-scam-checker" className="hover:text-zinc-200">WhatsApp Scam Checker</Link></li>
              <li><Link href="/sms-scam-checker" className="hover:text-zinc-200">SMS Scam Checker</Link></li>
              <li><Link href="/upi-scam-checker" className="hover:text-zinc-200">UPI Scam Checker</Link></li>
              <li><Link href="/link-scam-checker" className="hover:text-zinc-200">Link Scam Checker</Link></li>
              <li><Link href="/screenshot-scam-checker" className="hover:text-zinc-200">Screenshot Scanner</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Intelligence</div>
            <ul className="mt-2 space-y-1 text-xs">
              <li><Link href="/latest-scams" className="hover:text-zinc-200">Latest Scams</Link></li>
              <li><Link href="/scam-intelligence" className="hover:text-zinc-200">Trending Scams</Link></li>
              <li><Link href="/scam-database" className="hover:text-zinc-200">Scam Database</Link></li>
              <li><Link href="/contact" className="hover:text-zinc-200">Report a Scam</Link></li>
              <li><Link href="/scamcheck/account" className="hover:text-zinc-200">My Dashboard</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-800 pt-4 text-xs text-zinc-600">
          <Link href="/privacy-policy" className="hover:text-zinc-400">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-400">Terms</Link>
          <Link href="/disclaimer" className="hover:text-zinc-400">Disclaimer</Link>
          <span>© {new Date().getFullYear()} A Square Solutions. Automated risk assessment, not legal/financial advice.</span>
        </div>
      </div>
    </footer>
  )
}
