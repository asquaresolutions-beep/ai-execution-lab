#!/usr/bin/env node
// Evaluate scam fingerprinting + campaign clustering over the synthetic corpus
// (mirror of lib/scam-intel/{fingerprint,campaign-clustering}.ts — keep in sync).
// Reports clustering quality (purity vs gold category), fingerprint/cluster
// examples, and leaderboard analytics. Offline (real logic, no mocks).
// Run: node scripts/eval-clustering.mjs
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const scam = readFileSync(new URL('../datasets/synthetic/scam.jsonl', import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l))

const URLRE = /\b((?:https?:\/\/|hxxps?:\/\/)?(?:[a-z0-9-]+[.[\]]+)+[a-z]{2,}(?:\/[^\s)]*)?)/gi
const UPIRE = /\b[a-z0-9.\-_]{2,}@[a-z]+\b/gi
const PHONERE = /(?:\+?\d{1,3}[\s-]?)?\d{10}/g
const BRANDS = [['sbi', 'SBI'], ['hdfc', 'HDFC'], ['icici', 'ICICI'], ['paytm', 'Paytm'], ['phonepe', 'PhonePe'], ['amazon', 'Amazon'], ['flipkart', 'Flipkart'], ['india post', 'India Post'], ['blue dart', 'Blue Dart'], ['dtdc', 'DTDC'], ['fedex', 'FedEx']]

function domainCore(text) {
  const u = (text.match(URLRE) || [])[0]; if (!u) return null
  const host = u.replace(/^h(xx|tt)ps?:\/\//i, '').replace(/\[\.\]/g, '.').split(/[/?#]/)[0].toLowerCase()
  const l = host.split('.'); return l.length >= 2 ? l[l.length - 2] : host
}
function structureHash(text) {
  const skel = text.toLowerCase().replace(/https?:\/\/\S+|h(xx|tt)ps?:\/\/\S+/g, ' ').replace(/[₹$]|rs\.?|inr/gi, ' ').replace(/\d+/g, ' ').replace(/[^a-zऀ-ॿ\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2).slice(0, 24).join(' ')
  return createHash('sha1').update(skel).digest('hex').slice(0, 12)
}
function brandOf(text) { const t = text.toLowerCase(); for (const [k, v] of BRANDS) if (t.includes(k)) return v; return null }
function label(category, brand, text) {
  if (/kyc/i.test(text) && brand) return `Fake ${brand} KYC Suspension`
  return ({ fake_kyc: `Fake ${brand || 'Bank'} KYC Suspension`, upi_refund: 'Refund QR Collection Scam', fake_bank_alert: `Fake ${brand || 'Bank'} Account Alert`, courier: 'Courier Customs Fee Scam', investment: "Investment 'Guaranteed Returns' Scam", job: 'Work-From-Home Job Scam', crypto: 'Crypto Airdrop / Seed-Phrase Scam', fake_payment: 'Fake Payment Confirmation Scam', fake_whatsapp_support: 'Fake Customer-Support Scam', fake_ecommerce_refund: 'Fake Ecommerce Refund Scam' }[category] || 'Suspicious Message')
}

const recs = scam.map((s) => {
  const text = s.ocrText
  const brand = brandOf(text)
  const dc = domainCore(text)
  const struct = structureHash(text)
  const fp = createHash('sha1').update(`${s.category}|${brand ?? ''}|${dc ?? ''}|${struct}`).digest('hex').slice(0, 16)
  return { id: s.id, category: s.category, brand, domainCore: dc, structureHash: struct, fingerprint: fp, label: label(s.category, brand, text),
    upiIds: [...new Set(text.match(UPIRE) || [])], phones: [...new Set((text.match(PHONERE) || []).filter((p) => p.replace(/\D/g, '').length >= 10))] }
})

// Union-find on shared domain / structure / fingerprint / upi / phone.
const n = recs.length, parent = recs.map((_, i) => i)
const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]))
const union = (a, b) => { parent[find(a)] = find(b) }
const SHORTENERS = new Set(['bit', 'tinyurl', 'cutt', 't', 'wa', 'goo', 'rb', 'is', 'rebrand', 'tiny'])
const owner = new Map()
const link = (i, k) => { if (!k) return; const o = owner.get(k); if (o === undefined) owner.set(k, i); else union(o, i) }
recs.forEach((r, i) => { link(i, r.domainCore && !SHORTENERS.has(r.domainCore) ? `d:${r.domainCore}` : null); link(i, `s:${r.structureHash}`); link(i, `f:${r.fingerprint}`); r.upiIds.forEach((u) => link(i, `u:${u}`)); r.phones.forEach((p) => link(i, `p:${p}`)) })
const groups = new Map()
for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i) }

const clusters = [...groups.values()].map((idxs) => {
  const members = idxs.map((i) => recs[i])
  const cats = {}; for (const m of members) cats[m.category] = (cats[m.category] || 0) + 1
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]
  return { size: members.length, label: members[0].label, purity: topCat[1] / members.length, topCat: topCat[0], domains: [...new Set(members.map((m) => m.domainCore).filter(Boolean))] }
}).sort((a, b) => b.size - a.size)

const multi = clusters.filter((c) => c.size > 1)
const weightedPurity = clusters.reduce((a, c) => a + c.purity * c.size, 0) / n
console.log('══ Scam fingerprinting + campaign clustering (500 scam samples) ══')
console.log(`clusters: ${clusters.length} (${multi.length} multi-member), weighted purity=${weightedPurity.toFixed(3)}`)
console.log('\nTop campaigns:')
for (const c of clusters.slice(0, 10)) console.log(`  [${String(c.size).padStart(3)}] ${c.label.padEnd(38)} purity=${c.purity.toFixed(2)} domains=${c.domains.slice(0, 2).join(',') || '-'}`)

const fps = [...new Set(recs.map((r) => r.label))]
console.log(`\nDistinct scam fingerprints (${fps.length}):`); for (const f of fps.slice(0, 12)) console.log(`  - ${f}`)

const tally = (arr) => { const t = {}; for (const x of arr) t[x] = (t[x] || 0) + 1; return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 6) }
console.log('\n── Leaderboard ──')
console.log('Top spoofed brands:', tally(recs.map((r) => r.brand).filter(Boolean)).map(([k, v]) => `${k}(${v})`).join(', '))
console.log('Top scam domains:', tally(recs.map((r) => r.domainCore).filter(Boolean)).map(([k, v]) => `${k}(${v})`).join(', '))
console.log('\nnote: visual-style clustering + embedding NN-grouping run live (Vertex) via lib/scam-intel/clustering.ts + the scam_corpus table; this offline pass uses text/structure/domain signals only.')
