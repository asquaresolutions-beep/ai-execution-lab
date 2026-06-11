#!/usr/bin/env node
// Tests for the C1B verify engine. Runtime-tests the PURE core (score/normalize/ssrf
// — standalone-loadable, only `import type` + node builtins) and static-asserts the
// orchestrator + collectors (which chain @/-alias imports the node harness can't load).
// Run: node --experimental-strip-types scripts/test-trustseal-verify.mjs
import fs from 'node:fs'
import { scoreVerification, CATEGORY_WEIGHTS } from '../lib/trustseal/verify/score.ts'
import { normalizeDomain, verifyDocId } from '../lib/trustseal/verify/normalize.ts'
import { isPublicIp, allResolvedPublic } from '../lib/trustseal/verify/ssrf.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const sig = (category, status, score, extra = {}) => ({ id: `${category}.x`, category, status, score, source: 't', observedAt: 0, ...extra })

// ── normalize ──
ok('strips scheme/path/www → eTLD+1', normalizeDomain('https://www.Acme.com/pricing?x=1').canonical === 'acme.com')
ok('strips port + userinfo', normalizeDomain('user@acme.com:8443').canonical === 'acme.com')
ok('multi-part suffix co.uk', normalizeDomain('shop.acme.co.uk').canonical === 'acme.co.uk')
ok('co.in', normalizeDomain('www.acme.co.in').canonical === 'acme.co.in')
ok('plain subdomain → apex', normalizeDomain('login.acme.com').canonical === 'acme.com')
ok('reject IP literal', normalizeDomain('127.0.0.1') === null && normalizeDomain('8.8.8.8') === null)
ok('reject no-dot / empty', normalizeDomain('localhost') === null && normalizeDomain('') === null)
ok('verifyDocId deterministic vs_ prefix', /^vs_[a-f0-9]{32}$/.test(verifyDocId('acme.com')) && verifyDocId('acme.com') === verifyDocId('acme.com'))

// ── ssrf ──
ok('public IPs allowed', isPublicIp('8.8.8.8') && isPublicIp('1.1.1.1'))
ok('private/loopback/link-local/cgnat blocked', !isPublicIp('10.0.0.1') && !isPublicIp('127.0.0.1') && !isPublicIp('169.254.169.254') && !isPublicIp('192.168.1.1') && !isPublicIp('172.16.5.5') && !isPublicIp('100.64.0.1'))
ok('ipv6 loopback/link-local/ULA blocked', !isPublicIp('::1') && !isPublicIp('fe80::1') && !isPublicIp('fd00::1'))
ok('allResolvedPublic rejects mixed', allResolvedPublic(['8.8.8.8']) && !allResolvedPublic(['8.8.8.8', '10.0.0.1']) && !allResolvedPublic([]))

// ── score: weights sum 100 ──
ok('category weights sum 100', Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0) === 100)

// ── score: clean, fully-covered domain ──
const cleanSignals = [
  sig('reputation', 'ok', 92), sig('legitimacy', 'ok', 80), sig('dns', 'ok', 100),
  sig('ssl', 'ok', 100), sig('whois', 'ok', 90), sig('web', 'ok', 80), sig('impersonation', 'ok', 90),
]
const clean = scoreVerification({ signals: cleanSignals })
ok('clean → high score', clean.score >= 80)
ok('clean → confidence high (all hard covered)', clean.confidence >= 0.9)
ok('clean → verified (2+ hard signals)', clean.band === 'verified')

// ── caps ──
const bl = scoreVerification({ signals: [...cleanSignals, sig('reputation', 'ok', 0, { cap: 'blocklist', value: true })] })
ok('blocklist cap → score ≤15', bl.score <= 15 && bl.caps.some((c) => c.rule === 'blocklist'))
const imp = scoreVerification({ signals: [...cleanSignals, sig('impersonation', 'ok', 5, { cap: 'impersonation', value: true })] })
ok('impersonation cap → score ≤25', imp.score <= 25)
const ig = scoreVerification({ signals: [...cleanSignals, sig('reputation', 'ok', 5, { cap: 'intel_graph', value: true })] })
ok('intel_graph cap → score ≤30', ig.score <= 30)

// ── transparency / opacity: ≥2 hard categories blocked, no ok ──
const opaque = scoreVerification({ signals: [
  sig('dns', 'error', 0), sig('ssl', 'error', 0), sig('whois', 'timeout', 0),
  sig('reputation', 'ok', 90), sig('legitimacy', 'ok', 80),
] })
ok('opacity detected', opaque.opacity === true)
ok('opacity caps score ≤45', opaque.score <= 45 && opaque.caps.some((c) => c.rule === 'opacity'))
ok('blocked hard signal is penalty not neutral', opaque.categories.find((c) => c.category === 'dns').subScore <= 30)

// ── missing ≠ penalty ──
const missing = scoreVerification({ signals: [sig('reputation', 'ok', 90), sig('ssl', 'missing', 0), sig('dns', 'not_applicable', 0)] })
ok('missing/not_applicable → neutral 50 subscore (no penalty)', missing.categories.find((c) => c.category === 'ssl').subScore === 50 && missing.categories.find((c) => c.category === 'dns').subScore === 50)

// ── confidence gating ──
const oneCat = scoreVerification({ signals: [sig('reputation', 'ok', 100)] }) // only 1 hard cat covered (w=25)
ok('low coverage → low confidence', oneCat.confidence < 0.35)
ok('low confidence caps band at caution', oneCat.band === 'caution')
const twoCat = scoreVerification({ signals: [sig('reputation', 'ok', 100), sig('whois', 'ok', 100), sig('legitimacy', 'ok', 100), sig('ssl', 'ok', 100)] })
ok('mid coverage (<0.55) caps band ≤ limited', ['limited', 'caution', 'high_risk'].includes(twoCat.band) || twoCat.confidence >= 0.55)

// ── verified needs 2 independent hard signals ──
const noAnchor = scoreVerification({ signals: [sig('reputation', 'ok', 100), sig('dns', 'ok', 100), sig('ssl', 'ok', 100), sig('web', 'ok', 100), sig('impersonation', 'ok', 100)] })
ok('high score but no whois/legitimacy anchor → not verified', noAnchor.band !== 'verified')

// ── freshness decays confidence ──
const stale = scoreVerification({ signals: cleanSignals, ageSeconds: 86400, ttlSeconds: 86400 })
ok('stale (age=ttl) → freshness floor lowers confidence', stale.confidence < clean.confidence)

// ── static: orchestrator + collectors ──
const v = read('lib/trustseal/verify/verify.ts')
ok('single-flight dedupe map', /inflight = new Map/.test(v) && /inflight\.get\(key\)/.test(v))
ok('Promise.allSettled across collectors', /Promise\.allSettled/.test(v))
ok('per-collector AbortController timeout', /new AbortController/.test(v) && /setTimeout\(\(\) => ac\.abort/.test(v))
ok('collectors injected (no @/ imports in verify.ts)', !/@\//.test(v))
ok('InvalidDomainError on bad domain', /class InvalidDomainError/.test(v) && /normalizeDomain\(rawDomain\)/.test(v))
ok('failed collector → transparency error signal', /failSignal/.test(v) && /status: 'error'/.test(v))
const reg = read('lib/trustseal/verify/registry.ts')
ok('registry has 6 MVP collectors', ['dnsCollector', 'tlsCollector', 'rdapCollector', 'blocklistCollector', 'reputationCollector', 'impersonationCollector'].every((c) => reg.includes(c)))
ok('tls collector SSRF-guards (resolve + public check)', /allResolvedPublic/.test(read('lib/trustseal/verify/collectors/tls.ts')))
ok('blocklist hit → cap', /cap: 'blocklist'/.test(read('lib/trustseal/verify/collectors/blocklist.ts')))
ok('reputation/impersonation reuse scam-intel', /from '@\/lib\/scam-intel\/reputation'/.test(read('lib/trustseal/verify/collectors/reputation.ts')) && /from '@\/lib\/scam-intel\/impersonation'/.test(read('lib/trustseal/verify/collectors/impersonation.ts')))

console.log(`\ntrustseal-verify: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
