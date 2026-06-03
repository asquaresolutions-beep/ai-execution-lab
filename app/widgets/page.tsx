import type { Metadata } from 'next'

export const dynamic = 'force-static'

const BASE = (process.env.NEXT_PUBLIC_SCAM_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://scamcheck.asquaresolution.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Free Scam Alert Widgets — Embed Live India Scam Data | ScamCheck',
  description: 'Free embeddable widgets and badges showing live scam alerts in India. Add a latest-scams, city, or bank widget to your site in one line. Updates automatically.',
  alternates: { canonical: `${BASE}/widgets` },
  robots: { index: true, follow: true },
}

const SNIPPETS: { title: string; desc: string; code: string }[] = [
  {
    title: 'Latest scams in India',
    desc: 'A live, auto-updating list of trending scam alerts. Great for news, finance, and consumer sites.',
    code: `<script async src="${BASE}/widget.js" data-kind="latest" data-limit="5"></script>`,
  },
  {
    title: 'City scam widget',
    desc: 'Localise it to your city audience (set data-value to your city).',
    code: `<script async src="${BASE}/widget.js" data-kind="city" data-value="Mumbai" data-limit="5"></script>`,
  },
  {
    title: 'Bank scam widget',
    desc: 'Show alerts relevant to a bank’s customers.',
    code: `<script async src="${BASE}/widget.js" data-kind="bank" data-value="SBI" data-limit="5"></script>`,
  },
]

const BADGE = `<a href="${BASE}/scams" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;font:600 12px system-ui;color:#fff;background:#4f46e5;padding:6px 12px;border-radius:8px;text-decoration:none">🛡️ Scam-checked by ScamCheck</a>`

export default function WidgetsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Free scam alert widgets</h1>
        <p className="text-sm text-neutral-400">
          Add live India scam alerts to your site in one line. The widget updates automatically and
          includes a credit link back to ScamCheck. Free to use — attribution required.
        </p>
      </header>

      {SNIPPETS.map((s) => (
        <section key={s.title} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <h2 className="text-base font-semibold text-white">{s.title}</h2>
          <p className="mt-1 mb-3 text-sm text-neutral-400">{s.desc}</p>
          <pre className="overflow-x-auto rounded-md border border-neutral-800 bg-black/40 p-3 text-xs text-neutral-200"><code>{s.code}</code></pre>
        </section>
      ))}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <h2 className="text-base font-semibold text-white">“Scam-checked” trust badge</h2>
        <p className="mt-1 mb-3 text-sm text-neutral-400">A small linked badge for your footer or articles.</p>
        <pre className="overflow-x-auto rounded-md border border-neutral-800 bg-black/40 p-3 text-xs text-neutral-200"><code>{BADGE}</code></pre>
      </section>

      <p className="text-xs text-neutral-500">
        By embedding, you agree to keep the visible “Powered by ScamCheck” credit link intact. Data is provided for public-safety awareness.
      </p>
    </main>
  )
}
