// eval/scamcheck-result-presentation.test.mjs
//
// Regression tests for ScamCheck result presentation (audit 2026-10-04, Fix 8A/8B).
//
// 8A moved verdict styles, labels and share text into the pure module
// lib/scamcheck/result-presentation.ts. 8B makes it fail safe:
//   - only exact lowercase verdicts are accepted; anything else → `unclear` (grey);
//   - missing/odd categories never throw;
//   - share text is verdict-specific, never calls a non-safe verdict
//     safe/verified/legitimate, and never contains the user's input;
//   - the trusted note no longer claims "verified … likely legitimate".
// The two result components have no DOM test tooling in this repo (no jsdom /
// testing-library / JSX loader), so their wiring is checked statically below.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-result-presentation.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const P = await import(pathToFileURL(B + 'lib/scamcheck/result-presentation.ts').href)

const SUPPORTED = ['likely_scam', 'suspicious', 'needs_review', 'unclear', 'likely_safe']
const NOT_SAFE = ['likely_scam', 'suspicious', 'needs_review', 'unclear']
const MALFORMED = [undefined, null, 'LIKELY_SAFE', 'Likely_Safe', 'safe', ' likely_safe', 'likely_safe ', '', 0, 42, NaN, true, {}, [], 'scam']
// Reassuring wording that must never appear for a non-safe verdict.
const REASSURING = /\bverified\b|\blegitimate\b|\blegit\b|likely safe|low risk|✅/i
const SENTINEL = 'SENTINEL-USER-INPUT-7f3a9c'

// ── Verdict normalisation, styles and labels ──────────────────────────────
test('supported verdicts map to themselves', () => {
  for (const v of SUPPORTED) assert.equal(P.normalizeVerdict(v), v)
})
test('missing / malformed / unexpected verdicts map to unclear', () => {
  for (const v of MALFORMED) assert.equal(P.normalizeVerdict(v), 'unclear', `input ${String(v)}`)
})
test('styles: one per supported verdict (unchanged classes)', () => {
  assert.equal(P.verdictStyle('likely_scam'), 'bg-red-500/15 text-red-300 border-red-500/40')
  assert.equal(P.verdictStyle('suspicious'), 'bg-amber-500/15 text-amber-300 border-amber-500/40')
  assert.equal(P.verdictStyle('likely_safe'), 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40')
  assert.equal(P.verdictStyle('unclear'), 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40')
  assert.equal(P.verdictStyle('needs_review'), 'bg-sky-500/15 text-sky-300 border-sky-500/40')
})
test('styles: malformed verdicts get the grey unclear style, never green', () => {
  for (const v of MALFORMED) {
    assert.equal(P.verdictStyle(v), P.verdictStyle('unclear'), `input ${String(v)}`)
    assert.doesNotMatch(P.verdictStyle(v), /emerald/)
  }
})
test('labels: exact approved wording', () => {
  assert.deepEqual(SUPPORTED.map((v) => P.verdictLabel(v)), ['Likely scam', 'Suspicious', 'Needs review', 'Unclear', 'Likely safe'])
})
test('labels: malformed verdicts are labelled Unclear (never echo the raw value)', () => {
  for (const v of MALFORMED) assert.equal(P.verdictLabel(v), 'Unclear', `input ${String(v)}`)
})

// ── Categories ────────────────────────────────────────────────────────────
test('category: snake_case becomes words', () => {
  assert.equal(P.categoryLabel('otp_fraud'), 'otp fraud')
  assert.equal(P.categoryLabel('upi_fraud'), 'upi fraud')
})
test('category: missing or unexpected values never throw and render empty', () => {
  for (const c of [undefined, null, '', 0, 42, {}, [], true]) {
    assert.doesNotThrow(() => P.categoryLabel(c))
    assert.equal(P.categoryLabel(c), '', `input ${String(c)}`)
  }
})

// ── Share text ────────────────────────────────────────────────────────────
test('share: exact approved text for unclear and likely_safe', () => {
  assert.equal(P.buildShareSummary({ verdict: 'unclear', riskScore: 6 }),
    'Unable to determine. No clear scam signals were found, but this does not prove the message is safe.')
  assert.equal(P.buildShareSummary({ verdict: 'likely_safe', riskScore: 12 }),
    'ScamCheck rated this low risk (12/100). Always verify payments and requests through the official app.')
})
test('share: likely_scam warns not to pay, click links or share OTPs/codes', () => {
  const s = P.buildShareSummary({ verdict: 'likely_scam', riskScore: 72 })
  assert.match(s, /likely scam/i); assert.match(s, /72\/100/)
  assert.match(s, /not pay/i); assert.match(s, /click links/i); assert.match(s, /OTP/); assert.match(s, /security codes/i)
})
test('share: suspicious and needs_review advise independent verification before acting', () => {
  for (const v of ['suspicious', 'needs_review']) {
    const s = P.buildShareSummary({ verdict: v, riskScore: 42 })
    assert.match(s, /verify/i, v); assert.match(s, /before acting/i, v); assert.match(s, /42\/100/, v)
  }
})
test('share: non-safe verdicts never use reassuring wording', () => {
  for (const v of NOT_SAFE) assert.doesNotMatch(P.buildShareSummary({ verdict: v, riskScore: 30 }), REASSURING, v)
  for (const v of ['likely_scam', 'suspicious', 'needs_review']) assert.doesNotMatch(P.buildShareSummary({ verdict: v, riskScore: 50 }), /\bsafe\b/i, v)
  // `unclear` may only mention "safe" inside the explicit "does not prove … safe" disclaimer.
  assert.match(P.buildShareSummary({ verdict: 'unclear', riskScore: 0 }), /does not prove the message is safe/)
})
test('share: malformed verdicts produce the unclear text, never reassuring', () => {
  for (const v of MALFORMED) {
    const s = P.buildShareSummary({ verdict: v, riskScore: 5 })
    assert.equal(s, P.buildShareSummary({ verdict: 'unclear', riskScore: 5 }), `input ${String(v)}`)
    assert.doesNotMatch(s, REASSURING)
  }
})
test('share: never contains the user input (sentinel) for any verdict or shape', () => {
  for (const v of [...SUPPORTED, ...MALFORMED]) {
    const s = P.buildShareSummary({ verdict: v, riskScore: 40, category: SENTINEL, input: SENTINEL, value: SENTINEL, message: SENTINEL, label: SENTINEL })
    assert.ok(!s.includes(SENTINEL), `sentinel leaked for ${String(v)}`)
  }
})
test('share: missing / malformed result or risk never throws or prints NaN/undefined', () => {
  for (const r of [undefined, null, {}, { verdict: 'likely_scam' }, { verdict: 'likely_safe', riskScore: NaN }, { verdict: 'suspicious', riskScore: 'x' }]) {
    assert.doesNotThrow(() => P.buildShareSummary(r))
    assert.doesNotMatch(P.buildShareSummary(r), /NaN|undefined|null/)
  }
})

// ── Trusted note ──────────────────────────────────────────────────────────
test('trusted note: approved wording, no verified/legitimate claim', () => {
  assert.equal(P.TRUSTED_NOTE, "Mentions or links to an official domain. That alone doesn't prove who sent it — confirm in the official app.")
  assert.doesNotMatch(P.TRUSTED_NOTE, /verified|legitimate/i)
})

// ── Static wiring checks (no DOM tooling available) ─────────────────────────
const quick = readFileSync(B + 'components/scamcheck/quick-analyzer.tsx', 'utf8')
const shot = readFileSync(B + 'components/scamcheck/screenshot-analyzer.tsx', 'utf8')
test('wiring: result cards use the shared helpers, no raw .replace on verdict/category', () => {
  for (const src of [quick, shot]) {
    assert.match(src, /verdictStyle\(result\.verdict\)/); assert.match(src, /verdictLabel\(result\.verdict\)/)
    assert.doesNotMatch(src, /result\.verdict\.replace|\.category\.replace/)
  }
})
test('wiring: share uses a fixed site URL, never window.location (which can carry ?q=<input>)', () => {
  assert.match(quick, /<ShareResult summary=\{buildShareSummary\(result\)\} url=\{SITE\} \/>/)
  // Exactly one ShareResult and one SITE assignment: no second/commented-out share
  // button and no shadowed or reassigned SITE that could bypass the guard.
  assert.equal((quick.match(/<ShareResult\b/g) || []).length, 1)
  assert.equal((quick.match(/\bSITE\s*=(?!=)/g) || []).length, 1)
})
test('wiring: screenshot header no longer shows the trust score / scam probability', () => {
  assert.doesNotMatch(shot, /result\.trustScore|result\.scamProbability/)
})

// ── Share-URL guard: empty NEXT_PUBLIC_SITE_URL ────────────────────────────
// SCAMCHECK_BASE is `process.env.NEXT_PUBLIC_SITE_URL ?? <default>`, so an EMPTY
// env value yields "". ShareResult treats a falsy `url` as "use window.location
// .href", which can carry the user's message in ?q=. The quick analyzer must
// therefore never hand ShareResult an empty URL.
// No JSX/DOM tooling here, so this evaluates the REAL source expressions: the
// `const SITE = …` declaration in quick-analyzer.tsx and the `shareUrl` line in
// share-result.tsx (unchanged), chained exactly as at runtime.
const FIXED_SITE = 'https://scamcheck.asquaresolution.com'
const shareSrc = readFileSync(B + 'components/scamcheck/share-result.tsx', 'utf8')
function sourceExpr(src, re, what) {
  const m = src.match(re)
  assert.ok(m, `${what} not found`)
  return m[1].trim()
}
test('share URL guard: quick analyzer imports SCAMCHECK_BASE and passes the guarded SITE', () => {
  assert.match(quick, /^import \{ SCAMCHECK_BASE \} from '@\/lib\/seo\/scamcheck-meta'$/m)
  assert.match(quick, /<ShareResult summary=\{buildShareSummary\(result\)\} url=\{SITE\} \/>/)
})
test('share URL guard: empty or absent SITE → fixed ScamCheck URL, never window.location.href', () => {
  const siteOf = new Function('SCAMCHECK_BASE', `return (${sourceExpr(quick, /^const SITE = (.+)$/m, 'quick-analyzer `const SITE = …`')})`)
  const shareUrlOf = new Function('url', 'window', `return (${sourceExpr(shareSrc, /const shareUrl = (.+)$/m, 'share-result `const shareUrl = …`')})`)
  const win = { location: { href: `${FIXED_SITE}/?q=${SENTINEL}` } }
  // Control: ShareResult itself still falls back to window.location for an empty url.
  assert.equal(shareUrlOf('', win), win.location.href)
  for (const base of ['', undefined]) {
    const site = siteOf(base)
    assert.equal(site, FIXED_SITE, `SITE for SCAMCHECK_BASE=${JSON.stringify(base)}`)
    const shared = shareUrlOf(site, win)
    assert.equal(shared, FIXED_SITE)
    assert.ok(!shared.includes(SENTINEL), 'user input leaked into the share URL')
  }
  // A configured, non-empty value is still respected.
  assert.equal(siteOf('https://lab.asquaresolution.com'), 'https://lab.asquaresolution.com')
})
