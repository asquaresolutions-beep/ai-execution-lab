#!/usr/bin/env node
// TrustSeal Business billing + analytics. Pure billing logic is runtime-tested;
// routes/UI/analytics wiring is static-asserted. CRITICAL: proves Business is
// additive — Pro behavior is unchanged. Run: node --experimental-strip-types scripts/test-trustseal-business.mjs
import fs from 'node:fs'
import { deriveEntitlement, PLANS } from '../lib/billing/model.ts'
import { planOption, planTierForRazorpayPlanId, PLAN_OPTIONS } from '../lib/billing/plans.ts'
import { pendingSubscription, applyTransition } from '../lib/billing/webhook.ts'
import { quotaFor } from '../lib/trustseal/quota.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))
const NOW = 1_900_000_000_000
const sub = (o) => ({ id: 'u', accountId: 'u', plan: 'pro', interval: 'monthly', status: 'active', razorpayCustomerId: null, razorpaySubscriptionId: 's', razorpayPlanId: null, currentStart: NOW - 1000, currentEnd: NOW + 86_400_000, cancelAtCycleEnd: false, scheduledChange: null, lastEventId: null, lastEventAt: null, updatedAt: NOW, ...o })

// ── plan catalog ──
ok('plans: Business monthly = ₹1,999 (199900 paise)', planOption('monthly', 'business')?.amountPaise === 199900)
ok('plans: Business options have tier business', PLAN_OPTIONS.filter((p) => p.tier === 'business').length === 2)
ok('plans: Pro options unchanged (tier pro)', planOption('monthly')?.tier === 'pro' && planOption('yearly')?.tier === 'pro')
ok('plans: tier resolves from business plan id', planTierForRazorpayPlanId('plan_biz', { RAZORPAY_PLAN_BUSINESS_MONTHLY: 'plan_biz' }) === 'business')
ok('plans: pro/unknown/null plan id → pro', planTierForRazorpayPlanId('plan_pro', {}) === 'pro' && planTierForRazorpayPlanId(null) === 'pro')

// ── entitlement (additive, non-regressive) ──
ok('model: PLANS.business exists with monitoring', PLANS.business && PLANS.business.features.monitoring === true)
const ebiz = deriveEntitlement(sub({ plan: 'business' }), NOW)
ok('entitlement: active business → plan business, active, monitoring', ebiz.plan === 'business' && ebiz.active === true && ebiz.features.monitoring === true)
const epro = deriveEntitlement(sub({ plan: 'pro' }), NOW)
ok('entitlement: active pro UNCHANGED (plan pro, active)', epro.plan === 'pro' && epro.active === true)
ok('entitlement: business cancelled past end → free', deriveEntitlement(sub({ plan: 'business', status: 'cancelled', currentEnd: NOW - 1 }), NOW).plan === 'free')
ok('entitlement: free/none unchanged', deriveEntitlement(null, NOW).plan === 'free' && deriveEntitlement(sub({ plan: 'free' }), NOW).plan === 'free')

// ── quota tier for business ──
ok('quota: business plan → 3000 rpm', quotaFor('business').rpm === 3000)

// ── webhook tier threading (preserved across transitions) ──
ok('webhook: pendingSubscription honors plan (business)', pendingSubscription('u', { interval: 'monthly', razorpaySubscriptionId: 's', razorpayPlanId: 'p', plan: 'business' }, NOW).plan === 'business')
ok('webhook: pendingSubscription defaults to pro', pendingSubscription('u', { interval: 'monthly', razorpaySubscriptionId: 's', razorpayPlanId: 'p' }, NOW).plan === 'pro')
const cur = sub({ plan: 'business', status: 'created', currentEnd: null, lastEventAt: NOW - 10_000 })
const evt = { eventId: 'e1', type: 'subscription.activated', subscriptionId: 's', planId: 'p', uid: 'u', createdAt: NOW, currentStart: NOW, currentEnd: NOW + 86_400_000 }
ok('webhook: applyTransition PRESERVES business tier', applyTransition(cur, evt)?.plan === 'business')
ok('webhook: applyTransition defaults to pro with no prior record', applyTransition(null, evt)?.plan === 'pro')

// ── PART 1 wiring: checkout + UI ──
const subRoute = read('app/api/trustseal/billing/subscribe/route.ts')
ok('checkout: accepts {plan, interval} + passes tier to pending', /body\?\.plan === 'business'/.test(subRoute) && /plan: opt\.tier/.test(subRoute))
ok('checkout: business SKU gated by env (plan_not_configured)', /plan_not_configured/.test(subRoute))
const bs = read('components/trustseal/billing/billing-section.tsx')
ok('UI: Business badge + Go-Business button', /dash\.businessBadge/.test(bs) && /dash\.upgradeBusiness/.test(bs) && /subscribe\('monthly', 'business'\)/.test(bs))
ok('UI: graceful contact-sales when SKU not configured', /plan_not_configured/.test(bs) && /dash\.businessContact/.test(bs))
for (const f of ['en', 'hi', 'es', 'ar']) ok(`i18n: ${f} has businessBadge/upgradeBusiness keys`, /businessBadge:/.test(read(`lib/trustseal/messages/${f}.ts`)) && /upgradeBusiness:/.test(read(`lib/trustseal/messages/${f}.ts`)))

// ── PART 3: analytics ──
ok('analytics: module aggregates the tracked metrics', (() => { const a = read('lib/trustseal/analytics.ts'); return ['domainsVerified', 'certificatesAvailable', 'apiKeysProvisioned', 'apiRequestsThisMonth', 'monitoringAlerts', 'subscriptions'].every((m) => a.includes(m)) })())
ok('analytics: read-only (no event hooks into completed systems)', !/increment\(/.test(read('lib/trustseal/analytics.ts')))
ok('analytics: endpoint exists + admin-guarded', exists('app/api/trustseal/analytics/route.ts') && /isAuthorizedCron/.test(read('app/api/trustseal/analytics/route.ts')))

console.log(`\nBusiness billing + analytics tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
