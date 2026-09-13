// eval/auth-google-signin.test.mjs
//
// Offline tests for the shared Google sign-in fix (ScamCheck + TrustSeal).
//
//   1. Google script loading: success, blocked/failed, API missing, timeout, retry.
//   2. Rendered button: single initialize, popup mode, credential routed to the
//      button the user clicked (two buttons on one page = ScamCheck account page).
//   3. Credential → Firebase session exchange: success, no credential, network
//      failure, provider rejection, timeout (and the stalled request is aborted).
//   4. UI state machine: no state/event combination can strand the panel.
//   5. Authenticated session end-to-end: a signed ID token is accepted by the real
//      verifier and the real TrustSeal account route; guests/bogus tokens get 401.
//   6. ScamCheck behaviour unchanged: /api/credits guest vs signed-in quota, session
//      storage key, provider wiring on the pages that render the sign-in button.
//
// Nothing leaves the machine: fetch is stubbed (only the Google cert URL and the
// Identity Toolkit endpoint are answered; anything else is recorded as a violation),
// the store is the in-memory store, and the RSA key is generated per run. All
// secrets below are obvious fakes.
//
// Run: node --test --import ./eval/hooks.mjs eval/auth-google-signin.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { generateKeyPairSync, createSign } from 'node:crypto'

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key-not-a-real-secret'
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project'
delete process.env.FIREBASE_PROJECT_ID // keep getStore() off Firestore even if the shell has it
delete process.env.FIREBASE_API_KEY

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)
const src = (p) => readFileSync(B + p, 'utf8')

// ── fetch stub ────────────────────────────────────────────────────
const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
const IDP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp'
const KID = 'test-kid-1'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' })

let idp = null            // per-test Identity Toolkit behaviour: (init) => Response | Promise
let idpRequests = []
let violations = []
globalThis.fetch = async (url, init = {}) => {
  const u = String(url)
  if (u === CERT_URL) return new Response(JSON.stringify({ [KID]: PUBLIC_PEM }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } })
  if (u.startsWith(IDP_URL + '?key=')) { idpRequests.push({ url: u, init }); return idp(init) }
  violations.push(u)
  return new Response('{}', { status: 500 })
}

const G = await imp('lib/auth/google-signin.ts')
const { signInWithGoogleIdToken } = await imp('lib/auth/firebase.ts')
const { verifyFirebaseIdToken } = await imp('lib/auth/verify-token.ts')
const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
setStore(new MemoryStore())

const reset = () => { G.resetGoogleSignInForTests(); idp = null; idpRequests = []; violations = [] }
const codeOf = async (p) => { try { await p; return 'resolved' } catch (e) { return e?.code ?? `non-coded:${e?.message}` } }

// ── fakes ─────────────────────────────────────────────────────────
function fakeGis() {
  const g = { inits: [], renders: [] }
  g.initialize = (o) => g.inits.push(o)
  g.renderButton = (el, o) => { g.renders.push({ el, o }); el.innerHTML = '[google-button]' }
  return g
}
function fakeEl() { return { innerHTML: 'stale' } }
/** Minimal document: records appended <script> tags; `onAppend` decides what the "network" does. */
function fakeDoc(onAppend) {
  const byId = new Map()
  const doc = {
    appended: [],
    createElement: () => ({}),
    getElementById: (id) => byId.get(id) ?? null,
    head: {
      appendChild(el) {
        el.remove = () => { if (byId.get(el.id) === el) byId.delete(el.id) }
        byId.set(el.id, el)
        doc.appended.push(el)
        onAppend(el, doc.appended.length)
      },
    },
  }
  return doc
}
const IDP_OK = () => new Response(JSON.stringify({ localId: 'uid-123', email: 'person@example.test', displayName: 'Test Person', idToken: 'fb-id-token-fake', refreshToken: 'fb-refresh-fake', expiresIn: '3600' }), { status: 200 })

// ── 1. script loading ─────────────────────────────────────────────
test('load: resolves the Google Identity API once the script loads', async () => {
  reset()
  const win = {}
  const gis = fakeGis()
  const doc = fakeDoc((el) => { win.google = { accounts: { id: gis } }; queueMicrotask(el.onload) })
  const got = await G.loadGoogleIdentity({ doc, win, timeoutMs: 1000 })
  assert.equal(got, gis)
  assert.equal(doc.appended[0].src, 'https://accounts.google.com/gsi/client')
  assert.equal(doc.appended[0].id, 'gsi-client')
})

test('load: already-present API resolves immediately without adding a script', async () => {
  reset()
  const gis = fakeGis()
  const doc = fakeDoc(() => assert.fail('must not append a script'))
  assert.equal(await G.loadGoogleIdentity({ doc, win: { google: { accounts: { id: gis } } } }), gis)
})

test('prompt/script unavailable: a blocked or failed script rejects with script_failed (no hang)', async () => {
  reset()
  const doc = fakeDoc((el) => queueMicrotask(el.onerror))
  assert.equal(await codeOf(G.loadGoogleIdentity({ doc, win: {}, timeoutMs: 1000 })), 'script_failed')
})

test('prompt/script unavailable: script loads but the Google API is missing → unavailable', async () => {
  reset()
  const doc = fakeDoc((el) => queueMicrotask(el.onload))
  assert.equal(await codeOf(G.loadGoogleIdentity({ doc, win: {}, timeoutMs: 1000 })), 'unavailable')
})

test('timeout: a script that never loads rejects with script_timeout', async () => {
  reset()
  const doc = fakeDoc(() => { /* network never answers */ })
  const started = Date.now()
  assert.equal(await codeOf(G.loadGoogleIdentity({ doc, win: {}, timeoutMs: 40 })), 'script_timeout')
  assert.ok(Date.now() - started < 1000)
})

test('retry: a failed load is not cached — the next attempt replaces the dead tag and can succeed', async () => {
  reset()
  const win = {}
  const gis = fakeGis()
  const doc = fakeDoc((el, n) => {
    if (n === 1) queueMicrotask(el.onerror)
    else { win.google = { accounts: { id: gis } }; queueMicrotask(el.onload) }
  })
  assert.equal(await codeOf(G.loadGoogleIdentity({ doc, win, timeoutMs: 1000 })), 'script_failed')
  assert.equal(await G.loadGoogleIdentity({ doc, win, timeoutMs: 1000 }), gis)
  assert.equal(doc.appended.length, 2)
  assert.equal(doc.getElementById('gsi-client'), doc.appended[1])
})

test('load: concurrent callers share one script load', async () => {
  reset()
  const win = {}
  const gis = fakeGis()
  const doc = fakeDoc((el) => { win.google = { accounts: { id: gis } }; setTimeout(el.onload, 5) })
  const [a, b] = await Promise.all([G.loadGoogleIdentity({ doc, win }), G.loadGoogleIdentity({ doc, win })])
  assert.equal(a, gis); assert.equal(b, gis)
  assert.equal(doc.appended.length, 1)
})

// ── 2. rendered button + routing ──────────────────────────────────
test('button: popup-mode rendered button, initialize() once per page, no One Tap prompt', () => {
  reset()
  const gis = fakeGis()
  gis.prompt = () => assert.fail('One Tap prompt() must not be used')
  const a = fakeEl(), b = fakeEl()
  G.renderGoogleButton(gis, a, { clientId: 'client-x', onCredential: () => {}, width: 256, locale: 'hi' })
  G.renderGoogleButton(gis, b, { clientId: 'client-x', onCredential: () => {} })
  assert.equal(gis.inits.length, 1)
  assert.equal(gis.inits[0].client_id, 'client-x')
  assert.equal(gis.inits[0].ux_mode, 'popup')
  assert.equal(gis.inits[0].auto_select, false)
  assert.equal(gis.renders.length, 2)
  assert.equal(gis.renders[0].o.text, 'continue_with')
  assert.equal(gis.renders[0].o.locale, 'hi')
  assert.equal(gis.renders[0].o.width, 256)
  assert.equal(typeof gis.renders[0].o.click_listener, 'function')
  assert.equal(a.innerHTML, '[google-button]', 'container is cleared, not stacked')
})

test('button: the credential goes to the button the user CLICKED (two buttons on one page)', () => {
  reset()
  const gis = fakeGis()
  const got = []
  G.renderGoogleButton(gis, fakeEl(), { clientId: 'c', onCredential: (c) => got.push(['header', c]) })
  G.renderGoogleButton(gis, fakeEl(), { clientId: 'c', onCredential: (c) => got.push(['body', c]) })
  gis.renders[0].o.click_listener()               // user clicks the header button
  gis.inits[0].callback({ credential: 'cred-1' })
  assert.deepEqual(got, [['header', 'cred-1']])
  gis.renders[1].o.click_listener()
  gis.inits[0].callback({ credential: 'cred-2' })
  assert.deepEqual(got.at(-1), ['body', 'cred-2'])
})

test('button: without a click event the most recently rendered button handles the credential', () => {
  reset()
  const gis = fakeGis()
  const got = []
  G.renderGoogleButton(gis, fakeEl(), { clientId: 'c', onCredential: (c) => got.push(c) })
  gis.inits[0].callback({})
  assert.deepEqual(got, [undefined], 'a missing credential is still reported (→ no_credential), never swallowed')
})

// ── 3. credential → session exchange ─────────────────────────────
test('successful Google sign-in: credential is exchanged for a Firebase session of the unchanged shape', async () => {
  reset()
  idp = IDP_OK
  const user = await G.exchangeGoogleCredential('google-id-token-fake', signInWithGoogleIdToken, 1000)
  assert.equal(user.uid, 'uid-123')
  assert.equal(user.email, 'person@example.test')
  assert.equal(user.name, 'Test Person')
  assert.equal(user.idToken, 'fb-id-token-fake')
  assert.equal(user.refreshToken, 'fb-refresh-fake')
  assert.ok(user.expiresAt > Date.now())
  assert.equal(idpRequests.length, 1)
  const body = JSON.parse(idpRequests[0].init.body)
  assert.equal(body.postBody, 'id_token=google-id-token-fake&providerId=google.com')
  assert.equal(body.returnSecureToken, true)
  assert.ok(body.requestUri)
  assert.ok(idpRequests[0].init.signal instanceof AbortSignal, 'the exchange is abortable')
  assert.deepEqual(violations, [])
})

test('Google returned no credential → no_credential, and no request is made', async () => {
  reset()
  idp = () => assert.fail('must not call Firebase without a credential')
  assert.equal(await codeOf(G.exchangeGoogleCredential(undefined, signInWithGoogleIdToken, 1000)), 'no_credential')
  assert.equal(idpRequests.length, 0)
})

test('FedCM/network failure: a failed request surfaces as exchange_failed', async () => {
  reset()
  idp = () => { throw new TypeError('fetch failed') }
  assert.equal(await codeOf(G.exchangeGoogleCredential('tok', signInWithGoogleIdToken, 1000)), 'exchange_failed')
})

test('provider error: Firebase rejecting the Google token surfaces as exchange_failed', async () => {
  reset()
  idp = () => new Response(JSON.stringify({ error: { message: 'INVALID_IDP_RESPONSE' } }), { status: 400 })
  assert.equal(await codeOf(G.exchangeGoogleCredential('tok', signInWithGoogleIdToken, 1000)), 'exchange_failed')
})

test('provider error: a non-JSON error page is still a clean exchange_failed', async () => {
  reset()
  idp = () => new Response('<html>502</html>', { status: 502 })
  assert.equal(await codeOf(G.exchangeGoogleCredential('tok', signInWithGoogleIdToken, 1000)), 'exchange_failed')
})

test('timeout: a stalled exchange rejects with exchange_timeout and the request is aborted', async () => {
  reset()
  let aborted = false
  idp = (init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('aborted', 'AbortError')) })
  })
  const started = Date.now()
  assert.equal(await codeOf(G.exchangeGoogleCredential('tok', signInWithGoogleIdToken, 40)), 'exchange_timeout')
  assert.ok(Date.now() - started < 1000)
  assert.equal(aborted, true)
})

test('errorCode: unknown errors map to exchange_failed', () => {
  assert.equal(G.errorCode(new Error('boom')), 'exchange_failed')
  assert.equal(G.errorCode(new G.GoogleSignInError('script_timeout')), 'script_timeout')
})

// ── 4. UI state machine ───────────────────────────────────────────
const CODES = ['not_configured', 'script_failed', 'script_timeout', 'unavailable', 'no_credential', 'exchange_timeout', 'exchange_failed']
const STATES = [{ phase: 'loading' }, { phase: 'ready' }, { phase: 'exchanging' }, ...CODES.map((code) => ({ phase: 'error', code }))]
const EVENTS = [{ type: 'loaded' }, { type: 'credential' }, { type: 'signed_in' }, { type: 'retry' }, ...CODES.map((code) => ({ type: 'fail', code }))]

test('UI: every state × event lands on a clickable button, a visible error, or a timeout-bounded step', () => {
  for (const s of STATES) for (const e of EVENTS) {
    const n = G.googleUiReducer(s, e)
    const ok = n.phase === 'ready' || n.phase === 'error' || G.isTransient(n)
    assert.ok(ok, `${JSON.stringify(s)} + ${JSON.stringify(e)} → ${JSON.stringify(n)}`)
  }
})

test('UI: the only non-interactive phases are loading/exchanging, each guarded by a timeout', () => {
  assert.equal(G.isTransient({ phase: 'loading' }), true)
  assert.equal(G.isTransient({ phase: 'exchanging' }), true)
  assert.equal(G.isTransient({ phase: 'ready' }), false)
  assert.ok(G.GIS_LOAD_TIMEOUT_MS > 0 && G.GIS_LOAD_TIMEOUT_MS <= 15_000)
  assert.ok(G.EXCHANGE_TIMEOUT_MS > 0 && G.EXCHANGE_TIMEOUT_MS <= 30_000)
})

test('UI: happy path loading → ready → exchanging → ready; failure → error → retry → loading', () => {
  let s = G.initialGoogleUiState(true)
  assert.equal(s.phase, 'loading')
  s = G.googleUiReducer(s, { type: 'loaded' }); assert.equal(s.phase, 'ready')
  s = G.googleUiReducer(s, { type: 'credential' }); assert.equal(s.phase, 'exchanging')
  s = G.googleUiReducer(s, { type: 'fail', code: 'exchange_timeout' }); assert.deepEqual(s, { phase: 'error', code: 'exchange_timeout' })
  assert.equal(G.isRetryable(s), true)
  s = G.googleUiReducer(s, { type: 'retry' }); assert.equal(s.phase, 'loading')
})

test('UI: unconfigured build shows a non-retryable configuration message', () => {
  const s = G.initialGoogleUiState(false)
  assert.deepEqual(s, { phase: 'error', code: 'not_configured' })
  assert.equal(G.isRetryable(s), false)
  assert.deepEqual(G.googleUiReducer(s, { type: 'retry' }), s)
})

test('UI: every error code maps to a specific user-visible message', () => {
  assert.equal(G.errorLabelKey('not_configured'), 'notConfigured')
  assert.equal(G.errorLabelKey('script_failed'), 'googleUnavailable')
  assert.equal(G.errorLabelKey('unavailable'), 'googleUnavailable')
  assert.equal(G.errorLabelKey('script_timeout'), 'googleTimeout')
  assert.equal(G.errorLabelKey('exchange_timeout'), 'googleTimeout')
  assert.equal(G.errorLabelKey('exchange_failed'), 'googleFailed')
  assert.equal(G.errorLabelKey('no_credential'), 'googleFailed')
})

test('component wiring: no One Tap, no password fields, visible error + retry, bounded effects', () => {
  const btn = src('components/auth/auth-button.tsx')
  const prov = src('components/auth/auth-provider.tsx')
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  for (const s of [code(btn), code(prov)]) {
    assert.ok(!/\.prompt\(/.test(s), 'no One Tap prompt()')
    assert.ok(!/type="password"|type="email"/.test(s), 'no email/password inputs')
    assert.ok(!/signInEmail|signUpEmail/.test(s), 'email/password sign-in not exposed')
  }
  assert.match(btn, /loadGoogleIdentity\(\)/)
  assert.match(btn, /renderGoogleButton\(/)
  assert.match(btn, /role="alert"/)
  assert.match(btn, /isRetryable\(state\)/)
  assert.match(btn, /\.catch\(\(e\) => \{ if \(!cancelled\) dispatch\(\{ type: 'fail'/, 'script-load failures reach the UI')
  assert.match(btn, /dispatch\(\{ type: 'fail', code: errorCode\(e\) \}\)/, 'exchange failures reach the UI')
  assert.ok(!/console\.\w+\([^)]*credential/.test(code(btn)), 'the credential is never logged')
  assert.ok(!/disabled=\{busy/.test(btn), 'no busy flag that can stick')
  assert.match(prov, /exchangeGoogleCredential\(credential, signInWithGoogleIdToken\)/)
  assert.match(prov, /const STORAGE_KEY = 'sc_auth_v1'/, 'session storage key unchanged (existing sessions stay signed in)')
})

// ── 5. authenticated session end-to-end ───────────────────────────
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function idToken(claims = {}, { kid = KID, key = privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const payload = { iss: 'https://securetoken.google.com/test-project', aud: 'test-project', sub: 'uid-123', email: 'person@example.test', iat: now, exp: now + 3600, ...claims }
  const head = b64u({ alg: 'RS256', kid, typ: 'JWT' })
  const body = b64u(payload)
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(key).toString('base64url')
  return `${head}.${body}.${sig}`
}
const req = (path, token) => new Request(`https://trustseal.asquaresolution.com${path}`, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'x-forwarded-for': '203.0.113.9' } })

test('session: a valid Firebase ID token is accepted; expired, wrong-audience and tampered tokens are not', async () => {
  reset()
  assert.deepEqual(await verifyFirebaseIdToken(idToken()), { uid: 'uid-123', email: 'person@example.test' })
  assert.equal(await verifyFirebaseIdToken(idToken({ exp: Math.floor(Date.now() / 1000) - 10 })), null)
  assert.equal(await verifyFirebaseIdToken(idToken({ aud: 'other-project' })), null)
  const t = idToken().split('.'); t[1] = b64u({ sub: 'attacker', aud: 'test-project', iss: 'https://securetoken.google.com/test-project', exp: 9e9 })
  assert.equal(await verifyFirebaseIdToken(t.join('.')), null)
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
  assert.equal(await verifyFirebaseIdToken(idToken({}, { key: other })), null)
})

test('successful authenticated session: TrustSeal account route returns the signed-in account', async () => {
  reset()
  const { GET } = await imp('app/api/trustseal/account/route.ts')
  const res = await GET(req('/api/trustseal/account', idToken()))
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.uid, 'uid-123')
  assert.equal(body.email, 'person@example.test')
  assert.match(res.headers.get('cache-control') || '', /no-store/)
})

test('unauthenticated protected APIs still return 401 (no token, bogus token, expired token)', async () => {
  reset()
  const routes = [
    ['app/api/trustseal/account/route.ts', '/api/trustseal/account'],
    ['app/api/trustseal/claims/route.ts', '/api/trustseal/claims'],
    ['app/api/trustseal/billing/status/route.ts', '/api/trustseal/billing/status'],
  ]
  for (const [file, path] of routes) {
    const { GET } = await imp(file)
    for (const token of [null, 'not.a.token', idToken({ exp: Math.floor(Date.now() / 1000) - 10 })]) {
      const res = await GET(req(path, token))
      assert.equal(res.status, 401, `${path} with ${token ? 'bad' : 'no'} token`)
    }
  }
  assert.deepEqual(violations, [])
})

// ── 6. ScamCheck behaviour unchanged ──────────────────────────────
test('ScamCheck: /api/credits gives guests the guest quota and signed-in users the user quota', async () => {
  reset()
  const { GET } = await imp('app/api/credits/route.ts')
  const guest = await (await GET(req('/api/credits'))).json()
  assert.equal(guest.loggedIn, false)
  assert.equal(guest.quota, 3)
  const bogus = await (await GET(req('/api/credits', 'not.a.token'))).json()
  assert.equal(bogus.loggedIn, false, 'an invalid token is treated as a guest, as before')
  const signedIn = await (await GET(req('/api/credits', idToken()))).json()
  assert.equal(signedIn.loggedIn, true)
  assert.equal(signedIn.quota, 50)
  assert.equal(signedIn.email, 'person@example.test')
})

test('ScamCheck: pages that render the sign-in button still provide the auth context', () => {
  for (const p of ['app/scamcheck/page.tsx', 'app/scamcheck/account/page.tsx']) {
    const s = src(p)
    assert.match(s, /<AuthProvider>/, p)
    assert.match(s, /<AuthButton \/>/, p)
  }
  assert.match(src('components/scamcheck/account-dashboard.tsx'), /<AuthButton \/>/)
  // Consumers read only user/loading/configured — all still provided.
  const prov = src('components/auth/auth-provider.tsx')
  for (const k of ['user', 'loading', 'configured', 'signOut']) assert.match(prov, new RegExp(`\\b${k}\\b`))
  assert.match(src('hooks/use-credits.ts'), /Authorization: `Bearer \$\{user\.idToken\}`/, 'Bearer session header unchanged')
})

test('TrustSeal: dashboard passes localized labels + locale; all four dictionaries carry the new strings', () => {
  const dash = src('components/trustseal/dashboard-client.tsx')
  assert.match(dash, /<AuthButton labels=\{authLabels\} locale=\{locale\} \/>/)
  for (const k of ['googleLoading', 'googleSigningIn', 'googleUnavailable', 'googleTimeout', 'tryAgain']) {
    assert.match(dash, new RegExp(`auth\\.${k}`))
    for (const l of ['en', 'hi', 'es', 'ar']) assert.match(src(`lib/trustseal/messages/${l}.ts`), new RegExp(`${k}: '`), `${l}.${k}`)
  }
})
