// eval/scamcheck-host-trust.test.mjs
//
// Regression tests for ScamCheck trusted-host parsing and matching
// (audit 2026-10-04, Fix 3 + Fix 4).
//
// Fix 3: trust decisions used a string-splitting parser (rootDomain) that did not
// see hosts the way a browser does — `https://evil.example\.sbi.co.in` (browser
// host: evil.example) was trusted as SBI; credentials, ports and trailing dots
// were mishandled. Trust now uses the WHATWG URL parser and refuses anything
// ambiguous (backslash/whitespace, non-http(s) scheme, credentials, non-default
// port, IP literal, empty label).
// Fix 4: trust matched ANY subdomain of an entry (`h.endsWith('.' + d)`), and the
// list contained umbrella domains that host third-party content (gov.in,
// google.com, microsoft.com). Trust is now exact-host only (entry or `www.`entry);
// the umbrella entries are removed. Unconfirmable hosts fall to `unknown`, which
// the quick check reports as `unclear` — never as a scam on that basis alone.
//
// Offline and side-effect free: REAL production functions and the quick-check
// route handler, in-memory store, no AI/Firebase config, every fetch fails the
// test, one client IP per request. All inputs are synthetic.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-host-trust.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

for (const k of Object.keys(process.env)) {
  if (/^(FIREBASE|STORE_FILE|VERTEX|GOOGLE_|GCP_|BIGQUERY|GEMINI|RESEND|UPSTASH|KV_)/.test(k)) delete process.env[k]
}
process.env.LOG_LEVEL = 'error'

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const fetchCalls = []
globalThis.fetch = async (url) => { fetchCalls.push(String(url)); throw new Error(`network blocked in test: ${url}`) }

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
setStore(new MemoryStore())
const { strictHostname, domainReputation } = await imp('lib/scam-intel/reputation.ts')
const { POST } = await imp('app/api/scam-intel/quick-check/route.ts')

let n = 0
async function check(type, value) {
  n++
  const res = await POST(new Request('http://localhost/api/scam-intel/quick-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `10.96.${(n >> 8) & 255}.${n & 255}` },
    body: JSON.stringify({ type, value }),
  }))
  assert.equal(res.status, 200, `HTTP ${res.status} for ${type}:${value}`)
  return res.json()
}
const notGreen = (d, label) => { assert.notEqual(d.verdict, 'likely_safe', label); assert.equal(d.trusted, false, label) }

// ── Unit: strictHostname (the hostname used for trust decisions) ───────────
test('unit: strictHostname returns the browser-visible host for well-formed input', () => {
  assert.equal(strictHostname('https://www.sbi.co.in/web/x?y=1#z'), 'www.sbi.co.in')
  assert.equal(strictHostname('sbi.co.in'), 'sbi.co.in')
  assert.equal(strictHostname('HTTPS://SBI.CO.IN.'), 'sbi.co.in')          // one trailing dot = same FQDN
  assert.equal(strictHostname('https://sbi.co.in:443/login'), 'sbi.co.in')  // default port is the same origin
  assert.equal(strictHostname('https://evil.example.sbi.co.in/login'), 'evil.example.sbi.co.in')
})
test('unit: strictHostname refuses ambiguous / deceptive / malformed input (null = never trusted)', () => {
  for (const v of [
    'https://trusted.example@evil.example/login', 'https://sbi.co.in@evil.example/', // credentials
    'https://sbi.co.in:8443/login', 'sbi.co.in:8443',                               // non-default port
    'https://evil.example\\.sbi.co.in/login', 'https://evil.example:443\\@sbi.co.in', // backslash
    'https://sbi.co.in..', 'https://.sbi.co.in', 'https://', '', '   ',             // empty labels / empty
    'ftp://sbi.co.in/', 'javascript:alert(1)//sbi.co.in', 'data:text/html,sbi.co.in', // non-http(s)
    'https://sbi.co.in%2F.evil.example', 'https://sbi .co.in', 'https://203.0.113.7/', 'https://[2001:db8::1]/', 'localhost',
  ]) assert.equal(strictHostname(v), null, `input ${JSON.stringify(v)}`)
})
test('unit: domainReputation — exact official hosts trusted, umbrella/subdomain hosts not', () => {
  for (const h of ['sbi.co.in', 'www.sbi.co.in', 'hdfcbank.com', 'onlinesbi.sbi', 'incometax.gov.in', 'uidai.gov.in', 'scamcheck.asquaresolution.com'])
    assert.equal(domainReputation(h).reputation, 'trusted', h)
  for (const h of ['compromised.example.gov.in', 'gov.in', 'sites.google.com', 'google.com', 'microsoft.com', 'evil.example.sbi.co.in', 'netbanking.hdfcbank.com'])
    assert.equal(domainReputation(h).reputation, 'unknown', h)
  assert.equal(domainReputation('xn--pytm-5qa.com').reputation, 'suspicious') // existing punycode classification kept
})

// ── 1. Deceptive nested host ─────────────────────────────────────────────────
// Expected: unclear — a deep name under sbi.co.in cannot be confirmed as an
// official SBI site from the name alone, but there is no scam evidence either.
test('1: https://evil.example.sbi.co.in/login → unclear, not trusted', async () => {
  const d = await check('link', 'https://evil.example.sbi.co.in/login')
  assert.equal(d.verdict, 'unclear'); assert.equal(d.trusted, false)
})

// ── 2. Credentials (user-info) trick ─────────────────────────────────────────
// Expected: never trusted; the real host is evil.example (unknown → unclear).
test('2: https://trusted.example@evil.example/login → unclear, not trusted', async () => {
  const d = await check('link', 'https://trusted.example@evil.example/login')
  assert.equal(d.verdict, 'unclear'); assert.equal(d.trusted, false)
})
test('2: https://sbi.co.in@evil.example/login → not green, not trusted (look-alike handling unchanged)', async () => {
  notGreen(await check('link', 'https://sbi.co.in@evil.example/login'))
})

// ── 3. Ports and malformed URLs ──────────────────────────────────────────────
// Expected: a non-default port or any malformed/ambiguous URL is never trusted.
// It is NOT forced to scam: these fall to unclear unless other evidence exists.
test('3: https://sbi.co.in:8443/login (non-default port) → not trusted, not green', async () => {
  const d = await check('link', 'https://sbi.co.in:8443/login')
  notGreen(d); assert.notEqual(d.verdict, 'likely_scam')
})
test('3: https://sbi.co.in:443/login (default port = same origin) → likely_safe, trusted', async () => {
  const d = await check('link', 'https://sbi.co.in:443/login')
  assert.equal(d.verdict, 'likely_safe'); assert.equal(d.trusted, true)
})
for (const v of ['https://evil.example:443\\@sbi.co.in', 'https://evil.example\\.sbi.co.in/login', 'https://', 'https://sbi.co.in..',
  'ftp://sbi.co.in/', 'javascript:alert(1)//sbi.co.in', 'https://sbi.co.in%2F.evil.example']) {
  test(`3: malformed/ambiguous ${JSON.stringify(v)} → not trusted, not green`, async () => notGreen(await check('link', v)))
}

// ── 4. Trailing-dot hostnames ────────────────────────────────────────────────
// Expected: the absolute (FQDN) form of an official host IS that host → trusted.
// Previously these were false positives (likely_scam 85) because the look-alike
// parsers kept the dot. A deceptive suffix after the official name stays a scam.
test('4: https://SBI.CO.IN. → likely_safe, trusted (FQDN of the official host)', async () => {
  const d = await check('link', 'https://SBI.CO.IN.')
  assert.equal(d.verdict, 'likely_safe'); assert.equal(d.trusted, true)
})
test('4: https://www.hdfcbank.com./login → likely_safe, trusted', async () => {
  const d = await check('link', 'https://www.hdfcbank.com./login')
  assert.equal(d.verdict, 'likely_safe'); assert.equal(d.trusted, true)
})
test('4: https://sbi.co.in.evil.example/login → likely_scam (deceptive look-alike, unchanged)', async () => {
  const d = await check('link', 'https://sbi.co.in.evil.example/login')
  assert.equal(d.verdict, 'likely_scam'); assert.equal(d.trusted, false)
})

// ── 5–7. Umbrella domains no longer trusted ──────────────────────────────────
// Expected: unclear — anyone can publish on sites.google.com, and gov.in spans
// thousands of independently run (sometimes compromised) sites. Not a scam on
// that basis alone.
test('5: https://sites.google.com/view/sbi-kyc-update → unclear, not trusted', async () => {
  const d = await check('link', 'https://sites.google.com/view/sbi-kyc-update')
  assert.equal(d.verdict, 'unclear'); assert.equal(d.trusted, false)
})
test('6: https://compromised.example.gov.in → unclear, not trusted', async () => {
  const d = await check('link', 'https://compromised.example.gov.in')
  assert.equal(d.verdict, 'unclear'); assert.equal(d.trusted, false)
})
test('7: email refund@anything.gov.in → unclear, not trusted', async () => {
  const d = await check('email', 'refund@anything.gov.in')
  assert.equal(d.verdict, 'unclear'); assert.equal(d.trusted, false)
})

// ── 8. Genuine official links/emails keep their trusted result ───────────────
const OFFICIAL = [
  ['link', 'https://www.sbi.co.in/web/personal-banking'], ['link', 'https://sbi.co.in/login'],
  ['link', 'https://www.hdfcbank.com'], ['link', 'https://www.onlinesbi.sbi/login'],
  ['link', 'https://scamcheck.asquaresolution.com'], ['link', 'https://www.incometax.gov.in'], ['link', 'https://uidai.gov.in'],
  ['email', 'alerts@hdfcbank.com'], ['email', 'support@asquaresolution.com'],
]
for (const [type, value] of OFFICIAL) {
  test(`8: official ${type} ${value} → likely_safe, trusted`, async () => {
    const d = await check(type, value)
    assert.equal(d.verdict, 'likely_safe'); assert.equal(d.trusted, true)
  })
}
// Accepted trade-off: an official organisation's other subdomains are no longer
// auto-trusted (exact-host rule). They become unclear — never suspicious.
test('8: trade-off — https://netbanking.hdfcbank.com/x → unclear (not trusted, not suspicious)', async () => {
  const d = await check('link', 'https://netbanking.hdfcbank.com/x')
  assert.equal(d.verdict, 'unclear'); assert.equal(d.trusted, false)
})

// ── 9. Existing look-alike and punycode handling unchanged ───────────────────
test('9: Cyrillic homoglyph https://раytm.com → likely_scam', async () => {
  const d = await check('link', 'https://раytm.com')
  assert.equal(d.verdict, 'likely_scam'); assert.equal(d.trusted, false)
})
test('9: punycode https://xn--pytm-5qa.com → not green', async () => notGreen(await check('link', 'https://xn--pytm-5qa.com')))
test('9: look-alike email alerts@hdfcbank.com.verify.example → likely_scam', async () => {
  const d = await check('email', 'alerts@hdfcbank.com.verify.example')
  assert.equal(d.verdict, 'likely_scam'); assert.equal(d.trusted, false)
})

// ── A. Official government sites the app itself points users to ─────────────
// cybercrime.gov.in (reporting portal, used in quick-check advice),
// sancharsaathi.gov.in and sebi.gov.in are explicit EXACT entries — not a
// gov.in wildcard. Expected: likely_safe + trusted for the host and its `www.`
// form; other *.gov.in hosts (and subdomains of these entries) stay unclear.
for (const value of ['https://cybercrime.gov.in', 'https://www.cybercrime.gov.in/', 'https://sancharsaathi.gov.in',
  'https://www.sancharsaathi.gov.in/sfc/', 'https://sebi.gov.in', 'https://www.sebi.gov.in/investors.html']) {
  test(`A: official reporting/regulator site ${value} → likely_safe, trusted`, async () => {
    const d = await check('link', value)
    assert.equal(d.verdict, 'likely_safe'); assert.equal(d.trusted, true)
  })
}
for (const value of ['https://compromised.example.gov.in', 'https://report.cybercrime.gov.in.evil.example', 'https://portal.cybercrime.gov.in']) {
  test(`A: ${value} → not trusted, never green (no gov.in wildcard)`, async () => notGreen(await check('link', value)))
}
test('A: Google-hosted pages stay untrusted (sites.google.com, docs.google.com)', async () => {
  for (const value of ['https://sites.google.com/view/cybercrime-refund', 'https://docs.google.com/forms/d/e/x/viewform']) notGreen(await check('link', value), value)
})

// ── Trailing dot: only the EXACT official-domain comparison ignores it ───────
// The look-alike parsers keep the original host (including a trailing dot) for
// all detection and severity logic, exactly as at HEAD bf13128. Only the check
// "is this exactly an official domain?" strips one trailing dot, so the absolute
// form of an official host is not flagged as its own impersonation.
// Documented, intentional difference vs the non-dotted input: at HEAD a trailing
// dot on a NON-official look-alike escalates it to danger (likely_scam 85) while
// the non-dotted form scores suspicious 60; that HEAD escalation is preserved —
// a trailing dot must never lower a look-alike's verdict.
const { detectImpersonation } = await imp('lib/scam-intel/impersonation.ts')
const { analyzeUrl } = await imp('lib/scam-intel/url-intel.ts')
const impDangerSignal = (d) => d.signals.some((s) => s.id === 'brand_impersonation' && s.severity === 'danger')
test('trailing dot: official FQDNs are not impersonation (unit + route)', async () => {
  for (const v of ['https://sbi.co.in.', 'https://hdfcbank.com.', 'https://SBI.CO.IN.', 'alerts@hdfcbank.com.']) {
    assert.equal(detectImpersonation(v).isImpersonation, false, `detectImpersonation ${v}`)
    if (!v.includes('@')) assert.equal(analyzeUrl(v).severity, 'info', `analyzeUrl ${v}`)
  }
  for (const v of ['https://sbi.co.in.', 'https://hdfcbank.com.']) {
    const d = await check('link', v)
    assert.equal(d.verdict, 'likely_safe', v); assert.equal(d.trusted, true, v)
  }
})
const HEAD_DOTTED = [
  // [type, dotted input, HEAD verdict/risk, non-dotted equivalent, its verdict/risk]
  ['link', 'https://paytm-refund.top.', 'likely_scam', 85, 'https://paytm-refund.top', 'suspicious', 60],
  ['email', 'alerts@paytm-refund.top.', 'likely_scam', 85, 'alerts@paytm-refund.top', 'suspicious', 62],
  ['link', 'https://icicibank-secure.com.', 'likely_scam', 85, 'https://icicibank-secure.com', 'suspicious', 60],
  ['email', 'alerts@icicibank-secure.com.', 'likely_scam', 85, 'alerts@icicibank-secure.com', 'suspicious', 60],
  ['link', 'https://evil.example.sbi.co.in.', 'likely_scam', 85, 'https://evil.example.sbi.co.in', 'unclear', 12],
  ['email', 'alerts@evil.example.sbi.co.in.', 'likely_scam', 85, 'alerts@evil.example.sbi.co.in', 'unclear', 12],
]
for (const [type, dotted, verdict, risk, plain, plainVerdict, plainRisk] of HEAD_DOTTED) {
  test(`trailing dot: ${type} ${dotted} keeps its HEAD result ${verdict}/${risk} (danger impersonation)`, async () => {
    const d = await check(type, dotted)
    assert.equal(d.verdict, verdict); assert.equal(d.riskScore, risk); assert.equal(d.trusted, false)
    assert.ok(impDangerSignal(d), 'brand_impersonation signal must stay danger')
    assert.equal(detectImpersonation(dotted).severity, 'danger')
    const p = await check(type, plain)
    assert.equal(p.verdict, plainVerdict, `non-dotted ${plain}`); assert.equal(p.riskScore, plainRisk, `non-dotted ${plain}`)
    assert.ok(d.riskScore >= p.riskScore, 'a trailing dot must never lower a look-alike verdict')
  })
}
test('trailing dot: url-intel keeps HEAD findings for dotted look-alikes', () => {
  assert.deepEqual(analyzeUrl('https://evil.example.sbi.co.in.').risks, ['excessive_subdomains', 'brand_lookalike:sbi'])
  assert.equal(analyzeUrl('https://paytm-refund.top.').severity, 'danger')
  assert.equal(analyzeUrl('https://icicibank-secure.com.').severity, 'danger')
  assert.equal(analyzeUrl('https://sbi.co.in..').severity, 'danger') // doubled dot is not the official host
})

test('no network calls were attempted', () => {
  assert.deepEqual(fetchCalls, [])
})
