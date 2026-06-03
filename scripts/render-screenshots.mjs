#!/usr/bin/env node
// Render screenshot fixtures (goal 2) from the synthetic corpus as SVG mockups
// (SMS / WhatsApp / bank-alert chat UIs). Pure SVG — no image library needed.
// SVG is text so it's diff-able; to feed Gemini vision (which needs raster),
// rasterize with headless Chrome / rsvg-convert before upload, e.g.:
//   for f in datasets/synthetic/screenshots/*.svg; do
//     rsvg-convert "$f" -o "${f%.svg}.png"; done
// Usage: node scripts/render-screenshots.mjs [count=24]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const count = Number(process.argv[2]) || 24
const read = (n) => readFileSync(new URL(`../datasets/synthetic/${n}`, import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const scam = read('scam.jsonl'), legit = read('legit.jsonl')
mkdirSync(new URL('../datasets/synthetic/screenshots/', import.meta.url), { recursive: true })

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function wrap(text, max = 42) {
  const words = text.split(/\s+/); const lines = []; let cur = ''
  for (const w of words) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w } else cur += ' ' + w }
  if (cur.trim()) lines.push(cur.trim()); return lines.slice(0, 14)
}

function renderSMS(sample) {
  const lines = wrap(sample.ocrText)
  const header = sample.channel === 'whatsapp' ? '#075E54' : sample.channel === 'email' ? '#4285F4' : '#1f2937'
  const bubble = sample.channel === 'whatsapp' ? '#DCF8C6' : '#ffffff'
  const title = sample.channel === 'whatsapp' ? 'WhatsApp' : sample.channel === 'email' ? 'Inbox' : `SMS · ${sample.label === 'scam' ? 'Unknown' : 'Bank'}`
  const bodyH = 70 + lines.length * 22
  const rows = lines.map((l, i) => `<text x="40" y="${112 + i * 22}" font-family="Segoe UI, Arial" font-size="15" fill="#111">${esc(l)}</text>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${bodyH + 80}" viewBox="0 0 420 ${bodyH + 80}">
  <rect width="420" height="${bodyH + 80}" fill="#ECE5DD"/>
  <rect width="420" height="56" fill="${header}"/>
  <text x="20" y="35" font-family="Segoe UI, Arial" font-size="18" fill="#fff">${esc(title)}</text>
  <rect x="20" y="76" width="380" height="${bodyH}" rx="12" fill="${bubble}" stroke="#d1d5db"/>
  ${rows}
  <text x="380" y="${bodyH + 66}" text-anchor="end" font-family="Arial" font-size="11" fill="#6b7280">${sample.lang} · ${sample.category}</text>
</svg>`
}

const sel = [...scam.slice(0, Math.ceil(count / 2)), ...legit.slice(0, Math.floor(count / 2))]
let n = 0
for (const s of sel) { writeFileSync(new URL(`../datasets/synthetic/screenshots/${s.id}.svg`, import.meta.url), renderSMS(s)); n++ }
console.log(`Rendered ${n} SVG screenshot fixtures to datasets/synthetic/screenshots/`)
console.log('Rasterize to PNG (for Gemini vision) with: rsvg-convert <file>.svg -o <file>.png  (or headless Chrome screenshot)')
