#!/usr/bin/env node
// PR-1 (Auth + ts_accounts) tests. account.ts / the route / the dashboard client
// all chain @/-alias imports the node harness can't resolve, so — following the
// C1C convention — we STATIC-ASSERT their wiring + invariants; `next build` is the
// integration proof. Run: node --experimental-strip-types scripts/test-trustseal-pr1-account.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── lib/trustseal/account.ts ──────────────────────────────────────
const acct = read('lib/trustseal/account.ts')
ok('account: collection is ts_accounts', /ACCOUNTS\s*=\s*'ts_accounts'/.test(acct))
ok('account: exports requireUser', /export async function requireUser/.test(acct))
ok('account: exports upsertAccount', /export async function upsertAccount/.test(acct))
ok('account: exports getAccount', /export async function getAccount/.test(acct))
ok('account: reuses resolveSubject (no new auth crypto)', /resolveSubject/.test(acct) && /@\/lib\/api\/identify/.test(acct))
ok('account: persists via store adapter', /getStore/.test(acct) && /@\/lib\/store\/adapter/.test(acct))
ok('requireUser: rejects guests (loggedIn gate → null)', /!s\.loggedIn/.test(acct) && /return null/.test(acct))
ok('upsert: create-if-absent branch (store.get then set)', /store\.get<TrustAccount>\(ACCOUNTS, uid\)/.test(acct) && /store\.set<TrustAccount>\(ACCOUNTS, uid/.test(acct))
ok('upsert: PRESERVES createdAt on re-login (no createdAt in update patch)', /Partial<TrustAccount>\s*=\s*\{\s*lastSeenAt: now\s*\}/.test(acct) && !/patch\.createdAt/.test(acct))
ok('upsert: refreshes lastSeenAt', /lastSeenAt: now/.test(acct))
ok('schema: id/email/displayName?/createdAt/lastSeenAt', /id: string/.test(acct) && /email: string/.test(acct) && /displayName\?: string/.test(acct) && /createdAt: number/.test(acct) && /lastSeenAt: number/.test(acct))

// ── app/api/trustseal/account/route.ts ────────────────────────────
const route = read('app/api/trustseal/account/route.ts')
ok('route: GET handler', /export async function GET/.test(route))
ok('route: gates on requireUser', /requireUser\(req\)/.test(route))
ok('route: 401 for unauthorized', /status:\s*401/.test(route) && /unauthorized/.test(route))
ok('route: upserts the account', /upsertAccount\(user\.uid, user\.email\)/.test(route))
ok('route: dynamic = force-dynamic (per-user, not prerendered)', /dynamic\s*=\s*'force-dynamic'/.test(route))
ok('route: never cached (private, no-store)', /private, no-store/.test(route))
ok('route: returns profile fields', /uid:\s*account\.id/.test(route) && /email:\s*account\.email/.test(route))

// ── components/trustseal/dashboard-client.tsx ─────────────────────
const dash = read('components/trustseal/dashboard-client.tsx')
ok('dash: client component', /^'use client'/.test(dash))
ok('dash: reuses AuthProvider + useAuth', /AuthProvider/.test(dash) && /useAuth/.test(dash) && /@\/components\/auth\/auth-provider/.test(dash))
ok('dash: reuses AuthButton', /AuthButton/.test(dash) && /@\/components\/auth\/auth-button/.test(dash))
// i18n: dashboard chrome now flows through t(locale, 'dash.*').
ok('dash: signed-out state (sign-in prompt)', /x\('dash\.signInTitle'\)/.test(dash))
ok('dash: signed-in shell (Signed in as)', /x\('dash\.signedInAs'\)/.test(dash))
ok('dash: calls account API with Bearer token', /\/api\/trustseal\/account/.test(dash) && /Authorization: `Bearer \$\{user\.idToken\}`/.test(dash))
ok('dash: no-store fetch (fresh per-user)', /cache: 'no-store'/.test(dash))

// ── app/trustseal/[locale]/dashboard/page.tsx (modified) ──────────
const page = read('app/trustseal/[locale]/dashboard/page.tsx')
ok('page: stays a SERVER component (no use client)', !/'use client'/.test(page))
ok('page: keeps locale-aware metadata via buildTrustMeta (noindex default)', /generateMetadata/.test(page) && /buildTrustMeta/.test(page))
ok('page: renders the client shell', /DashboardClient/.test(page))
ok('page: no dynamic server reads (no next/headers import)', !/from 'next\/headers'/.test(page))

// ── SSG invariant on the parent layout (must remain static) ───────
const layout = read('app/trustseal/[locale]/layout.tsx')
ok('layout: dynamicParams=false preserved', /dynamicParams\s*=\s*false/.test(layout))
ok('layout: generateStaticParams preserved', /generateStaticParams/.test(layout))
ok('layout: still no dynamic request reads (no next/headers import)', !/from 'next\/headers'/.test(layout))

console.log(`\nPR-1 account tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
