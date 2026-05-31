#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// scripts/gen-launch-pack.mjs
// Generates the launch content pack DETERMINISTICALLY from the SEO facet
// data + alert formatters — ZERO Vertex/AI cost. Emits a markdown brief:
// 20 priority scam topics, 10 Shorts ideas, LinkedIn posts, X threads,
// Hindi targets, and Discover candidates.
//
// Single source of truth = lib/seo/facets.ts + lib/distribution/alert-formats.ts
// (transpiled in-memory with the TS compiler, like gen-firestore-indexes).
//   Usage: node scripts/gen-launch-pack.mjs
// ─────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import ts from 'typescript'

const root = process.cwd()

function loadTs(rel, deps = {}) {
  // Minimal in-memory transpile + eval for a single dependency-light module.
  const src = readFileSync(path.join(root, rel), 'utf8')
  const js = ts.transpileModule(src, { compilerOptions: { module: 'ESNext', target: 'ES2022' } }).outputText
  return { src, js }
}

// facets.ts has no imports → transpile + import directly.
const facetsOut = ts.transpileModule(readFileSync(path.join(root, 'lib/seo/facets.ts'), 'utf8'),
  { compilerOptions: { module: 'ESNext', target: 'ES2022' } }).outputText
const facetsTmp = path.join(os.tmpdir(), `facets-${Date.now()}.mjs`)
writeFileSync(facetsTmp, facetsOut)
const facets = await import(pathToFileURL(facetsTmp).href)

const { SCAM_TYPES, CITIES } = facets

// Priority order for launch (matches brief): UPI, WhatsApp(→phishing/upi),
// Telegram investment, fake KYC, fake job, then the rest by demand tier.
const PRIORITY = ['upi-fraud', 'otp-fraud', 'kyc-fraud', 'investment-fraud', 'fake-job', 'phishing', 'loan-scam', 'courier-scam', 'electricity-bill-scam', 'lottery-scam', 'tech-support-scam', 'romance-scam']
const byId = new Map(SCAM_TYPES.map((t) => [t.id, t]))
const ordered = [...PRIORITY.map((id) => byId.get(id)).filter(Boolean), ...SCAM_TYPES.filter((t) => !PRIORITY.includes(t.id))]

const topCities = CITIES.slice(0, 6).map((c) => c.name)

// ── 20 priority scam topics (type + top city/platform angles) ──────
const topics = []
for (const t of ordered) {
  topics.push(`${t.name} — /scams/type/${t.id}`)
  if (topics.length >= 12) break
}
// City + platform angle topics to reach 20
const angles = [
  `UPI fraud in ${topCities[0]} — /scams/type/upi-fraud/${slugc(topCities[0])}`,
  `WhatsApp investment scam — /scams/platform/whatsapp`,
  `Telegram investment/task scam — /scams/platform/telegram`,
  `Fake KYC (SBI) — /scams/bank/sbi`,
  `Google Pay / UPI collect-request scam — /scams/upi/google-pay`,
  `Fake job task scam on Telegram — /scams/type/fake-job`,
  `Electricity bill disconnection SMS — /scams/type/electricity-bill-scam`,
  `Festival sale / delivery scam — /scams/hub/festival-scams`,
]
topics.push(...angles)
const topics20 = topics.slice(0, 20)

// ── 10 Shorts ideas (hooks) ────────────────────────────────────────
const shorts = ordered.slice(0, 10).map((t, i) =>
  `${i + 1}. [${t.name}] Hook: "Got this ${t.name.toLowerCase()} message? The 1 sign that gives it away…" → show ${t.signs[0]} → CTA: check free + report 1930.`)

// ── LinkedIn authority posts (5) ───────────────────────────────────
const linkedin = ordered.slice(0, 5).map((t) =>
  `• ${t.name}: "${t.hook}" → 3 warning signs + how to verify + report 1930. (Authority framing: data-backed, calm, protective.)`)

// ── X/Twitter alert threads (5 openers) ────────────────────────────
const xthreads = ordered.slice(0, 5).map((t) =>
  `🧵 ${t.name} is spreading. How to spot it: 1) ${t.signs[0]} 2) ${t.signs[1] || 'unexpected urgency'} … ✅ ${t.protect[0]} · report 1930.`)

// ── Hindi targets (10) ─────────────────────────────────────────────
const hindi = ordered.slice(0, 10).map((t) => `${t.nameHi} (${t.name}) — bilingual page + Hindi OG`)

// ── Discover candidates (strongest first) ──────────────────────────
const discover = ordered.filter((t) => t.searchVolumeTier === 1).map((t) => `${t.name} — tier-1 demand, high severity, fresh-able`)

const md = `# ScamCheck — Launch Content Pack
_Generated deterministically from facet data — no AI/Vertex cost. Regenerate: \`node scripts/gen-launch-pack.mjs\`._

## 1) First 20 priority scam topics
${topics20.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## 2) First 10 Shorts ideas
${shorts.join('\n')}

## 3) LinkedIn authority posts
${linkedin.join('\n')}

## 4) X/Twitter alert threads
${xthreads.join('\n')}

## 5) Hindi scam targets
${hindi.map((h, i) => `${i + 1}. ${h}`).join('\n')}

## 6) Strongest Discover candidates
${discover.map((d, i) => `${i + 1}. ${d}`).join('\n')}

> Channel-ready snippets (X/thread/carousel/WhatsApp/Telegram/Shorts) per topic are available at runtime from
> \`/api/scam-intel/alert-formats?type=<id>\` (deterministic, CDN-cached).
`

writeFileSync(path.join(root, 'content/docs/launch-content-pack.mdx'), frontmatter() + md)
console.log('✓ wrote content/docs/launch-content-pack.mdx')
console.log(`  topics:${topics20.length} shorts:${shorts.length} linkedin:${linkedin.length} xthreads:${xthreads.length} hindi:${hindi.length} discover:${discover.length}`)

function slugc(s) { return s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') }
function frontmatter() {
  return `---\ntitle: "ScamCheck Launch Content Pack"\ndescription: "Deterministically-generated launch pack: 20 priority scam topics, 10 Shorts ideas, LinkedIn posts, X threads, Hindi targets, and Discover candidates for ScamCheck. Zero AI cost."\ndate: "2026-05-31"\ntags: ["scamcheck", "launch", "distribution", "shorts", "hindi", "discover"]\nstatus: published\n---\n\n`
}
