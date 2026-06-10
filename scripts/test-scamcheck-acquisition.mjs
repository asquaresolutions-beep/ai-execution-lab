#!/usr/bin/env node
// Tests for the ScamCheck acquisition PR (asq-acquisition-v1). Static-source
// assertions: capture placement + source attribution on the 4 research pages,
// the lead-magnet wiring (instant download, no email), the static asset, and the
// middleware allowlist for /guides. Run: node scripts/test-scamcheck-acquisition.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))

// ── lead magnet (single source of truth, static asset, no email) ──
const lm = read('lib/newsletter/lead-magnets.ts')
ok('FAKE_UPI_MAGNET exported', /export const FAKE_UPI_MAGNET/.test(lm))
ok('magnet points at a static /public asset', /href:\s*'\/guides\/fake-upi-scam-detection-guide\.html'/.test(lm))
ok('static guide asset exists in /public', exists('public/guides/fake-upi-scam-detection-guide.html'))
const guide = read('public/guides/fake-upi-scam-detection-guide.html')
ok('guide is real content (UPI detection)', /UTR/.test(guide) && /payment successful/i.test(guide) && guide.length > 1500)

// ── NewsletterCapture: reused component gains magnet (instant download, no email) ──
const nc = read('components/scamcheck/newsletter-capture.tsx')
ok('component accepts a magnet prop', /magnet\?:\s*\{\s*href:\s*string;\s*title:\s*string\s*\}/.test(nc))
ok('success state renders a download link', /href=\{magnet\.href\}\s+download/.test(nc))
ok('download tracked in existing dataLayer analytics', /track\('lead_magnet_download'/.test(nc))
ok('still posts to existing /api/newsletter (no new backend)', /fetch\('\/api\/newsletter'/.test(nc))
ok('no email send in component (download only)', !/resend|sendListEmail|api\/.*send/i.test(nc))
ok('mobile responsive (stacks then rows)', /flex-col gap-2 sm:flex-row/.test(nc))

// ── placement + source attribution on the 4 research pages ──
const pages = {
  'app/latest-scams/page.tsx': 'research:latest-scams',
  'app/scam-database/page.tsx': 'research:scam-database',
  'app/scam-intelligence/page.tsx': 'research:scam-intelligence',
}
for (const [file, source] of Object.entries(pages)) {
  const c = read(file)
  ok(`${file} renders NewsletterCapture`, /<NewsletterCapture\b/.test(c))
  ok(`${file} imports the shared component + magnet`, /from '@\/components\/scamcheck\/newsletter-capture'/.test(c) && /FAKE_UPI_MAGNET/.test(c))
  ok(`${file} tags source="${source}"`, c.includes(`source="${source}"`))
  ok(`${file} offers the magnet`, /magnet=\{FAKE_UPI_MAGNET\}/.test(c))
}
// detail page uses per-slug source attribution
const slug = read('app/scam-intelligence/[slug]/page.tsx')
ok('[slug] renders NewsletterCapture with per-page source', /<NewsletterCapture source=\{`intel:\$\{p\.slug\}`\}/.test(slug))
ok('[slug] offers the magnet', /magnet=\{FAKE_UPI_MAGNET\}/.test(slug))

// ── middleware: /guides reachable on the scamcheck product host ──
const mw = read('middleware.ts')
ok('middleware allowlists /guides for the scamcheck host', /'\/guides'/.test(mw))

console.log(`\nscamcheck-acquisition: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
