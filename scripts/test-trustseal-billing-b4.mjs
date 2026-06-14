#!/usr/bin/env node
// TrustSeal Billing — Phase B4 (entitlement enforcement) tests.
// The capability decision is pure (deriveEntitlement.features), so we verify every
// account scenario at runtime; the store-bound enforce helper + the protected
// surfaces (seal API badge gate, command access API, command gate, badge.js) are
// static-asserted; next build is the integration proof. Server-side only.
// Run: node --experimental-strip-types scripts/test-trustseal-billing-b4.mjs
import fs from 'node:fs'
import { deriveEntitlement, GRACE_MS, PLANS } from '../lib/billing/model.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

const DAY = 24 * 60 * 60 * 1000
const now = 1_750_000_000_000
const sub = (over = {}) => ({
  id: 'u1', accountId: 'u1', plan: 'pro', interval: 'monthly', status: 'active',
  razorpayCustomerId: 'c', razorpaySubscriptionId: 's', razorpayPlanId: 'p',
  currentStart: now - 10 * DAY, currentEnd: now + 20 * DAY, cancelAtCycleEnd: false,
  scheduledChange: null, lastEventId: null, lastEventAt: null, updatedAt: now, ...over,
})
// Capability check mirrors enforce.hasFeature: entitlement.features[feature] === true.
const can = (s, feature) => deriveEntitlement(s, now).features[feature] === true
const PRO_CAPS = ['badgeWidget', 'commandCenter', 'analytics']

// ── plan capability matrix (Free vs Pro) ──────────────────────────
ok('caps: Free has none of the Pro capabilities', PRO_CAPS.every((f) => PLANS.free.features[f] === false))
ok('caps: Pro has all of them', PRO_CAPS.every((f) => PLANS.pro.features[f] === true))

// ── FREE ACCOUNT (no subscription) → denied everything ────────────
ok('free: missing subscription → no badge', !can(null, 'badgeWidget'))
ok('free: missing subscription → no command center', !can(null, 'commandCenter'))
ok('free: missing subscription → no analytics', !can(null, 'analytics'))

// ── PRO ACCOUNT (active) → granted everything ─────────────────────
ok('pro/active: badge granted', can(sub(), 'badgeWidget'))
ok('pro/active: command center granted', can(sub(), 'commandCenter'))
ok('pro/active: analytics granted', can(sub(), 'analytics'))

// ── GRACE PERIOD (active, past currentEnd within grace) → granted ─
ok('grace: within grace still grants Pro caps', can(sub({ currentEnd: now - 1 * DAY }), 'commandCenter'))
ok('grace: beyond grace → denied', !can(sub({ currentEnd: now - (GRACE_MS / DAY + 1) * DAY }), 'commandCenter'))
ok('failed-renewal (past_due) within grace → granted', can(sub({ status: 'past_due', currentEnd: now - 1 * DAY }), 'badgeWidget'))
ok('failed-renewal (past_due) beyond grace → denied', !can(sub({ status: 'past_due', currentEnd: now - 10 * DAY }), 'badgeWidget'))

// ── CANCELLED subscription ────────────────────────────────────────
ok('cancelled with future end → still granted (paid term)', can(sub({ status: 'cancelled', currentEnd: now + 5 * DAY }), 'badgeWidget'))
ok('cancelled past end → denied (no extra grace)', !can(sub({ status: 'cancelled', currentEnd: now - 1 }), 'badgeWidget'))

// ── EXPIRED / halted ──────────────────────────────────────────────
ok('expired → denied', !can(sub({ status: 'expired' }), 'commandCenter'))
ok('halted within paid term → granted; past end → denied', can(sub({ status: 'halted', currentEnd: now + DAY }), 'badgeWidget') && !can(sub({ status: 'halted', currentEnd: now - 1 }), 'badgeWidget'))

// ── MISSING / malformed subscription docs → denied (fail-closed) ──
ok('missing doc (null) → denied', !can(null, 'badgeWidget'))
ok('malformed: pro plan but no currentEnd → denied', !can(sub({ currentEnd: null }), 'commandCenter'))
ok('malformed: non-pro plan value → denied', !can(sub({ plan: 'free' }), 'badgeWidget'))
ok('created (checkout started, unpaid) → denied', !can(sub({ status: 'created' }), 'commandCenter'))

// ── RECONCILIATION RECOVERY scenario ──────────────────────────────
// A missed activation webhook left the doc 'created' (denied); reconcile heals it
// to 'active' with a real currentEnd → capabilities are then granted. (Healing is
// covered by B2.3; here we assert the entitlement consequence post-heal.)
ok('reconcile-recovery: created (denied) → healed active (granted)',
  !can(sub({ status: 'created', currentEnd: null }), 'commandCenter') &&
  can(sub({ status: 'active', currentEnd: now + 20 * DAY }), 'commandCenter'))

// ── enforce helper: server-side, fail-closed (static-assert) ──────
const enforce = read('lib/billing/enforce.ts')
ok('enforce: resolves via getEntitlement (server-authoritative)', /getEntitlement\(uid\)/.test(enforce) && /@\/lib\/billing\/entitlement/.test(enforce))
ok('enforce: checks per-capability feature flag', /ent\.features\[feature\] === true/.test(enforce))
ok('enforce: fail-closed (empty uid + catch → false)', /if \(!uid\) return false/.test(enforce) && /catch\s*\{[\s\S]*return false/.test(enforce))
ok('enforce: capability guards (badge/command/analytics)', /isBadgeEntitled/.test(enforce) && /isCommandCenterEntitled/.test(enforce) && /isAnalyticsEntitled/.test(enforce))

// ── badge enforcement (seal API + badge.js) ───────────────────────
const seal = read('app/api/trustseal/seal/[domain]/route.ts')
ok('badge: seal API resolves owning account server-side', /getVerifiedClaimAccountId\(data\.domain\)/.test(seal))
ok('badge: seal API gates via isBadgeEntitled', /isBadgeEntitled\(accountId\)/.test(seal) && /badgeEntitled/.test(seal))
ok('badge: accountId never returned to client', !/accountId:/.test(seal))
const sealLib = read('lib/trustseal/seal.ts')
ok('badge: server-only accountId resolver exported', /export async function getVerifiedClaimAccountId/.test(sealLib))
const badge = read('app/api/trustseal/badge.js/route.ts')
ok('badge.js: embeddable badge gated on d.badgeEntitled', /!d\.badgeEntitled/.test(badge))

// ── command center enforcement (access API + gate) ────────────────
const access = read('app/api/trustseal/command/access/route.ts')
ok('command: access API authenticated (requireUser → 401)', /requireUser\(req\)/.test(access) && /status: 401/.test(access))
ok('command: access API gates on entitlement → 403', /isCommandCenterEntitled\(user\.uid\)/.test(access) && /status: 403/.test(access))
const gate = read('components/trustseal/command/command-gate.tsx')
ok('command: gate enforces via the server access API', /\/api\/trustseal\/command\/access/.test(gate) && /Bearer \$\{user\.idToken\}/.test(gate))
ok('command: surface renders ONLY on server 200 (entitled)', /r\.ok \? 'entitled' : 'denied'/.test(gate) && /state === 'entitled'/.test(gate))
ok('command: denied path shows upgrade (no command surface)', /Pro feature/.test(gate))
const page = read('app/trustseal/[locale]/command/page.tsx')
ok('command: page renders the gate (not the bare center)', /<CommandGate/.test(page) && !/<CommandCenter/.test(page))

// ── scope: enforcement is server-side; Free surfaces untouched ────
ok('scope: enforcement reads server-side only (gate trusts the API, not local plan)', !/localStorage|deriveEntitlement|getEntitlement/.test(gate))
const claimVerify = read('app/api/trustseal/verify/route.ts')
ok('scope: domain verification stays FREE (no entitlement gate added)', !/isBadgeEntitled|isCommandCenterEntitled|hasFeature/.test(claimVerify))

console.log(`\nBilling B4 enforcement tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
