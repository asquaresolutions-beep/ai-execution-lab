#!/usr/bin/env node
// Tests for the newsletter growth system (PR B): ScamCheck→blog resource
// selection, the WP growth plan, and the embeddable widget integrity.
// Imports REAL modules via Node TS type-stripping (no logic drift).
// Run: node --experimental-strip-types scripts/test-blog-growth.mjs
import fs from 'node:fs'
import { BLOG_RESOURCES, resourcesForChecker, getBlogResource, BLOG_HUB } from '../lib/scamcheck/blog-resources.ts'
import { buildPlan, blockHtml, CHECKER_LINK } from './wp/plan-blog-growth.mjs'

let pass = 0, fail = 0
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.error(`✗ ${label}`) } }
const eq = (label, got, want) => ok(`${label} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))

// ── catalog integrity ─────────────────────────────────────────────
ok('catalog non-empty', BLOG_RESOURCES.length >= 5)
ok('all resources have absolute https blog urls', BLOG_RESOURCES.every((r) => /^https:\/\/asquaresolution\.com\/blog\/[a-z0-9-]+\/$/.test(r.url)))
ok('all resources have title + blurb', BLOG_RESOURCES.every((r) => r.title.length > 3 && r.blurb.length > 10))
ok('all resources tagged with >=1 checker', BLOG_RESOURCES.every((r) => r.relevantTo.length >= 1))
ok('slugs unique', new Set(BLOG_RESOURCES.map((r) => r.slug)).size === BLOG_RESOURCES.length)
ok('getBlogResource resolves a known slug', !!getBlogResource(BLOG_RESOURCES[0].slug))
ok('getBlogResource undefined for unknown', getBlogResource('nope') === undefined)
ok('BLOG_HUB is the blog root', /\/blog\/$/.test(BLOG_HUB))

// ── relevance selection ───────────────────────────────────────────
const upi = resourcesForChecker('upi-scam-checker', 3)
eq('returns exactly the requested count', upi.length, 3)
ok('UPI page surfaces the UPI guide first', upi[0].relevantTo.includes('upi-scam-checker'))
ok('selection has no duplicates', new Set(upi.map((r) => r.slug)).size === upi.length)
// even an unknown checker still gets filled to the limit (graceful)
eq('unknown checker still filled', resourcesForChecker('made-up-checker', 3).length, 3)
eq('limit honored', resourcesForChecker('email-scam-checker', 2).length, 2)

// ── WP growth plan (reciprocal links + block) ─────────────────────
const plan = buildPlan()
ok('plan covers every blog resource', plan.length === BLOG_RESOURCES.length)
ok('every planned post has >=1 ScamCheck link', plan.every((p) => p.links.length >= 1))
ok('planned links point to scamcheck host', plan.every((p) => p.links.every((l) => l.url.startsWith('https://scamcheck.asquaresolution.com/'))))
ok('planned anchors come from the link map', plan.every((p) => p.links.every((l) => Object.values(CHECKER_LINK).includes(l.anchor))))

// ── injected block HTML ───────────────────────────────────────────
const html = blockHtml(plan[0])
ok('block carries link rollback marker', html.includes('asq-growth-links-v1'))
ok('block carries newsletter rollback marker', html.includes('asq-growth-cta-v1'))
ok('block includes the embeddable widget host', html.includes('data-scamcheck-alert'))
ok('block tags source with the post slug', html.includes(`data-source="blog:${plan[0].postSlug}"`))
ok('block loads the embed script', html.includes('/embed/scam-alert.js'))
ok('block links use rel=noopener', /rel="noopener"/.test(html))

// ── embeddable widget file integrity ──────────────────────────────
const widget = fs.readFileSync(new URL('../public/embed/scam-alert.js', import.meta.url), 'utf8')
ok('widget posts to the newsletter API', widget.includes('/api/newsletter'))
ok('widget sends consent', widget.includes('consent: true'))
ok('widget has a honeypot field', widget.includes('asq-hp'))
ok('widget handles duplicate response', widget.includes('duplicate'))
ok('widget sends device + source', widget.includes('device:') && widget.includes('source:'))
ok('widget has rollback marker', widget.includes('asq-growth-cta-v1'))

console.log(`\nblog-growth: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
