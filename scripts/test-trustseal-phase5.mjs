#!/usr/bin/env node
// TrustSeal Phase 5 — Monitoring engine + Business plan.
// diffSnapshot is pure → runtime-tested; the engine/wiring + the additive billing
// feature are static-asserted (the full billing suite proves no regression).
// Run: node --experimental-strip-types scripts/test-trustseal-phase5.mjs
import fs from 'node:fs'
import { diffSnapshot } from '../lib/trustseal/monitoring/diff.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))
const sig = (ssl, dns) => [{ id: 'ssl.valid', status: ssl }, { id: 'dns.resolves', status: dns }]

// ── diff engine (pure) ──
const base = { band: 'established', score: 85, signals: sig('ok', 'ok') }
ok('diff: no change → no alerts', diffSnapshot(base, { ...base }).length === 0)
ok('diff: band down → critical-ish band_down', (() => { const e = diffSnapshot(base, { band: 'caution', score: 60, signals: sig('ok','ok') }); return e.some(a => a.kind === 'band_down' && a.severity === 'critical') })())
ok('diff: band up → info', diffSnapshot({ band: 'limited', score: 70, signals: sig('ok','ok') }, base).some(a => a.kind === 'band_up' && a.severity === 'info'))
ok('diff: score drop (same band) → warning', diffSnapshot(base, { band: 'established', score: 70, signals: sig('ok','ok') }).some(a => a.kind === 'score_drop'))
ok('diff: small score wobble (same band) → no alert', diffSnapshot(base, { band: 'established', score: 83, signals: sig('ok','ok') }).length === 0)
ok('diff: SSL broke → critical ssl_changed', diffSnapshot(base, { ...base, signals: sig('expired','ok') }).some(a => a.kind === 'ssl_changed' && a.severity === 'critical'))
ok('diff: DNS change → dns_changed', diffSnapshot(base, { ...base, signals: sig('ok','error') }).some(a => a.kind === 'dns_changed'))
ok('diff: band change does NOT also emit score_drop (no double-signal)', !diffSnapshot(base, { band: 'caution', score: 60, signals: sig('ok','ok') }).some(a => a.kind === 'score_drop'))

// ── Business plan: additive billing feature (monitoring) ──
const model = read('lib/billing/model.ts')
ok('billing: PlanFeatures has monitoring flag', /monitoring:\s*boolean/.test(model))
ok('billing: free.monitoring = false, pro.monitoring = true', /free:[\s\S]*?monitoring: false[\s\S]*?\},/.test(model) && /pro:[\s\S]*?monitoring: true/.test(model))
ok('billing: BillingPlan union unchanged (no risky new tier in core model)', /BillingPlan = 'free' \| 'pro'/.test(model))
ok('billing: isMonitoringEntitled guard added', /export const isMonitoringEntitled/.test(read('lib/billing/enforce.ts')))

// ── monitoring engine wiring ──
ok('monitor: alerts store is equality-only (no composite index)', (() => { const a = read('lib/trustseal/monitoring/alerts.ts'); return /op: '=='/.test(a) && !/orderBy/.test(a) && /\.sort\(/.test(a) })())
const scan = read('lib/trustseal/monitoring/scan.ts')
ok('monitor: scan gates on monitoring entitlement', /features\.monitoring === true/.test(scan))
ok('monitor: scan re-verifies via forceRefresh (reuses engine + appends history)', /forceRefresh: true/.test(scan) && /getVerification/.test(scan))
ok('monitor: scan diffs snapshots + writes alerts', /diffSnapshot/.test(scan) && /writeAlert/.test(scan))
ok('monitor: scan emails digest gracefully (only if configured)', /emailConfigured\(\)/.test(scan) && /sendListEmail/.test(scan))
ok('monitor: scan is bounded per run', /MAX_DOMAINS/.test(scan))

// ── cron + endpoints + dashboard ──
const cron = read('app/api/cron/trustseal-monitor/route.ts')
ok('cron: route exists, authed, daily-capable', /isAuthorizedCron/.test(cron) && /runMonitoringScan/.test(cron))
ok('cron: registered in vercel.json (daily)', (() => { const v = read('vercel.json'); return /trustseal-monitor/.test(v) && /"0 4 \* \* \*"/.test(v) })())
ok('api: /api/trustseal/monitoring authed + returns entitled+alerts', (() => { const r = read('app/api/trustseal/monitoring/route.ts'); return /requireUser/.test(r) && /isMonitoringEntitled/.test(r) && /readAlerts/.test(r) })())
const dash = read('components/trustseal/dashboard-client.tsx')
ok('dash: MonitoringSection mounted', /<MonitoringSection locale=\{locale\}/.test(dash))
const sec = read('components/trustseal/monitoring-section.tsx')
ok('dash: monitoring section gates entitled vs Business upsell', /info\.entitled/.test(sec) && /Business/.test(sec) && /₹1,999/.test(sec))
ok('dash: monitoring section localized (en/hi/es/ar) self-contained', /LABELS: Record<Locale/.test(sec) && /\ben:/.test(sec) && /\bhi:/.test(sec) && /\bes:/.test(sec) && /\bar:/.test(sec))

console.log(`\nPhase-5 tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
