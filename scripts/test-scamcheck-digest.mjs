#!/usr/bin/env node
// Tests for the Weekly ScamCheck Digest engine (asq-scamcheck-digest-v1).
// Unit-tests the pure composer (real fn) + static-asserts the draft-first /
// never-auto-send / approval-gated invariants in the engine, route, and cron.
// Run: node --experimental-strip-types scripts/test-scamcheck-digest.mjs
import fs from 'node:fs'
import { composeScamDigest } from '../lib/newsletter/digest-copy.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const NOW = Date.parse('2026-06-10T00:00:00Z')

// ── composer ──
const items = [
  { title: 'Fake UPI payment screenshot', category: 'payment_fraud', trendScore: 9 },
  { title: 'KYC update phishing SMS', category: 'phishing', trendScore: 7 },
  { title: 'Fake loan app', category: 'loan_scam', trendScore: 5 },
]
const d = composeScamDigest(items, NOW)
ok('composes a digest', !!d && d.itemCount === 3)
ok('subject mentions count', /Top 3 scams/.test(d.subject))
ok('body lists scam titles', d.bodyHtml.includes('Fake UPI payment screenshot') && d.bodyHtml.includes('KYC update phishing SMS'))
ok('prettifies category', /Payment Fraud/.test(d.bodyHtml))
ok('CTA links to ScamCheck', d.bodyHtml.includes('scamcheck.asquaresolution.com/latest-scams'))
ok('escapes HTML in titles', composeScamDigest([{ title: '<b>x</b>', category: 'x' }], NOW).bodyHtml.includes('&lt;b&gt;'))
ok('caps at maxItems', composeScamDigest(Array.from({ length: 20 }, (_, i) => ({ title: 'scam ' + i, category: 'c' })), NOW, 6).itemCount === 6)
ok('skips items without a title', composeScamDigest([{ category: 'c' }, { title: 'real', category: 'c' }], NOW).itemCount === 1)
ok('no content → null (no draft)', composeScamDigest([], NOW) === null && composeScamDigest([{ category: 'x' }], NOW) === null)

// ── engine invariants (static) ──
const eng = read('lib/newsletter/campaigns.ts')
ok('draft-first: compose creates status draft', /status: 'draft'/.test(eng))
ok('compose is idempotent per week (skips if exists)', /draft-exists/.test(eng))
ok('approve only from draft', /c\.status !== 'draft'/.test(eng))
ok('HARD gate: enqueue only from approved', /c\.status !== 'approved'/.test(eng) && /never send an unapproved/.test(eng))
ok('send drain only touches sending campaigns', /c\.status !== 'sending'/.test(eng))
ok('send drain flag-gated (never auto-send by default)', /WEEKLY_DIGEST_ENABLED !== 'true'/.test(eng))
ok('reuses sendListEmail', /sendListEmail\(/.test(eng))
ok('reuses trending_snapshots via latestTrendingSnapshot', /latestTrendingSnapshot\(/.test(eng))
ok('recipient fan-out is idempotent (deterministic id)', /cs_\$\{id\}_\$\{subscriberDocId\(email\)\}/.test(eng))
ok('skips unsubscribed recipients', /s\.data\?\.unsubscribed/.test(eng))
ok('no deletes in engine', !/\.delete\(/.test(eng))

// ── admin route (token-gated, draft-first actions) ──
const route = read('app/api/admin/campaigns/route.ts')
ok('route admin-gated', /requireAdmin\(req\)\.ok/.test(route) && /status: 401/.test(route))
ok('route exposes compose/approve/send only', /'compose'/.test(route) && /'approve'/.test(route) && /'send'/.test(route))

// ── cron wiring: draft compose + flag-gated drain, isolated ──
const dq = read('app/api/cron/drain-queue/route.ts')
ok('cron composes weekly draft (never sends)', /await composeWeeklyScamcheckDraft\(\)/.test(dq))
ok('cron drains sends in isolated try/catch', /processCampaignSends\(\)/.test(dq) && /cron\.digest_send/.test(dq))

console.log(`\nscamcheck-digest: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
