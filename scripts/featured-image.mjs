// ─────────────────────────────────────────────────────────────────
// scripts/featured-image.mjs  (asq-featured-image-v2)
// Canonical featured-image generator for A Square Solutions blog posts.
// 7 category visual systems, 1200x675, dark + high-contrast, mobile-readable,
// social/Discover-optimized. The OFFICIAL transparent logo (assets/asq-logo-white.png)
// is composited subtly into the footer (height 38px, aspect preserved), beside
// "asquaresolution.com". Logo never overlaps the headline (footer band only).
//   node scripts/featured-image.mjs samples   # render one preview per category -> _brandprev/
// Programmatic: import { generateFeatured, CATEGORIES } from './featured-image.mjs'
// ─────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const LOGO_PATH = path.join(__dir, '..', 'assets', 'asq-logo-white.png')
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

// Cache the trimmed, height-normalized logo (aspect preserved) + its width.
let _logo = null
async function getLogo() {
  if (_logo) return _logo
  if (!fs.existsSync(LOGO_PATH)) throw new Error('logo missing at ' + LOGO_PATH)
  const buf = await sharp(LOGO_PATH).trim().resize({ height: 38, fit: 'inside' }).png().toBuffer()
  const w = (await sharp(buf).metadata()).width
  _logo = { buf, w }
  return _logo
}

// ── 7 category visual systems ──
const M = {
  shield: a => `<g transform="translate(880,165)" fill="none" stroke="${a}" stroke-width="5"><path d="M120 0 L240 42 V182 q0 108 -120 166 q-120 -58 -120 -166 V42 Z" fill="#1a1320"/><rect x="80" y="150" width="80" height="62" rx="8" fill="#0b1120"/><path d="M96 150 V128 a24 24 0 0 1 48 0 V150"/><circle cx="120" cy="182" r="7" fill="${a}"/></g>`,
  ai: a => `<g transform="translate(850,165)"><circle cx="160" cy="160" r="66" fill="#2e1065" stroke="${a}" stroke-width="5"/><path d="M160 122 l13 28 l28 13 l-28 13 l-13 28 l-13 -28 l-28 -13 l28 -13 z" fill="${a}"/><g fill="#c4b5fd"><circle cx="40" cy="55" r="20"/><circle cx="290" cy="48" r="20"/><circle cx="40" cy="285" r="20"/><circle cx="290" cy="285" r="20"/></g><g stroke="#7c3aed" stroke-width="3"><line x1="56" y1="70" x2="115" y2="120"/><line x1="272" y1="64" x2="210" y2="120"/><line x1="56" y1="270" x2="115" y2="205"/><line x1="272" y1="270" x2="210" y2="205"/></g></g>`,
  bars: a => `<g transform="translate(840,180)" stroke="${a}" stroke-width="5" fill="none"><line x1="20" y1="300" x2="320" y2="300"/><rect x="40" y="200" width="56" height="100" fill="#0e2748"/><rect x="140" y="140" width="56" height="160" fill="#0e2748"/><rect x="240" y="80" width="56" height="220" fill="${a}" stroke="none"/><path d="M40 250 L168 150 L296 70" stroke="#93c5fd" stroke-width="5"/><path d="M268 70 h28 v28" stroke="#93c5fd"/></g>`,
  megaphone: a => `<g transform="translate(860,180)" fill="none" stroke="${a}" stroke-width="5"><path d="M20 90 L150 60 V200 L20 170 Z" fill="#3a0f2e"/><path d="M20 90 H0 V170 H20" /><path d="M150 70 q70 60 0 120" /><path d="M55 175 v60 a18 18 0 0 0 36 0 v-46" fill="#3a0f2e"/></g>`,
  molecule: a => `<g transform="translate(850,150)" stroke="${a}" stroke-width="5" fill="none"><polygon points="170,30 250,75 250,165 170,210 90,165 90,75" fill="#06302c"/><g fill="${a}" stroke="none"><circle cx="170" cy="30" r="14"/><circle cx="250" cy="75" r="14"/><circle cx="250" cy="165" r="14"/><circle cx="170" cy="210" r="14"/><circle cx="90" cy="165" r="14"/><circle cx="90" cy="75" r="14"/></g><g transform="translate(150,250)" fill="${a}" stroke="none"><rect x="0" y="20" width="60" height="20" rx="4"/><rect x="20" y="0" width="20" height="60" rx="4"/></g></g>`,
  news: a => `<g transform="translate(870,165)"><rect x="0" y="0" width="230" height="300" rx="12" fill="none" stroke="${a}" stroke-width="5"/><g fill="#fbbf24"><rect x="28" y="38" width="174" height="16" rx="4"/><rect x="28" y="76" width="140" height="12" rx="3"/><rect x="28" y="102" width="160" height="12" rx="3"/></g><g transform="translate(150,165)" stroke="${a}" stroke-width="9" fill="#0b1120"><circle cx="58" cy="58" r="46"/><line x1="92" y1="92" x2="146" y2="146" stroke-linecap="round"/></g></g>`,
  seal: a => `<g transform="translate(880,150)"><path d="M130 0 L250 42 V190 q0 110 -120 168 q-120 -58 -120 -168 V42 Z" fill="#1e1b4b" stroke="${a}" stroke-width="5" fill-opacity="0.5"/><circle cx="130" cy="150" r="60" fill="#312e81" stroke="#818cf8" stroke-width="4"/><path d="M101 150 l21 21 l38 -48" fill="none" stroke="#34d399" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><text x="130" y="262" text-anchor="middle" font-family="Arial" font-weight="800" font-size="24" fill="#a5b4fc" letter-spacing="2">VERIFIED</text></g>`,
}
export const CATEGORIES = {
  'scam-cybersecurity': { tag: 'SCAM / CYBERSECURITY', accent: '#ef4444', bg2: '#1a1320', motif: M.shield },
  ai:                   { tag: 'AI & TECHNOLOGY',       accent: '#a855f7', bg2: '#1e1142', motif: M.ai },
  business:             { tag: 'BUSINESS',              accent: '#3b82f6', bg2: '#0d1b33', motif: M.bars },
  marketing:            { tag: 'MARKETING',             accent: '#ec4899', bg2: '#2a0f24', motif: M.megaphone },
  science:              { tag: 'SCIENCE & HEALTH',      accent: '#14b8a6', bg2: '#062b27', motif: M.molecule },
  news:                 { tag: 'NEWS & ANALYSIS',       accent: '#f59e0b', bg2: '#161a23', motif: M.news },
  trustseal:            { tag: 'TRUSTSEAL · VERIFIED',  accent: '#6366f1', bg2: '#1e1b4b', motif: M.seal },
}

function buildSVG({ accent, bg2, tag, headline, motif, urlX }) {
  let y = 270
  const lines = headline.map(t => { const e = `<text x="70" y="${y}" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="76" fill="#ffffff">${esc(t)}</text>`; y += 84; return e }).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
   <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1120"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
   <rect width="1200" height="675" fill="url(#bg)"/><rect width="1200" height="10" fill="${accent}"/>
   <text x="70" y="175" font-family="Arial" font-weight="800" font-size="40" fill="${accent}" letter-spacing="3">${esc(tag)}</text>
   ${lines}${motif(accent)}
   <line x1="70" y1="582" x2="1130" y2="582" stroke="rgba(120,160,255,0.15)" stroke-width="2"/>
   <text x="${urlX}" y="625" font-family="Arial" font-weight="500" font-size="19" fill="#64748b">· asquaresolution.com</text>
  </svg>`
}

/** Generate a featured-image JPG buffer for a category. headline = array of lines. */
export async function generateFeatured({ category, headline }) {
  const c = CATEGORIES[category]; if (!c) throw new Error('unknown category ' + category)
  const logo = await getLogo()
  const urlX = 70 + logo.w + 16   // url sits right of the composited logo
  const svg = buildSVG({ ...c, headline, urlX })
  const base = await sharp(Buffer.from(svg)).jpeg({ quality: 84, chromaSubsampling: '4:4:4' }).toBuffer()
  // Composite the official logo into the footer (left), vertically centered on the URL text.
  return sharp(base).composite([{ input: logo.buf, left: 70, top: 600 }]).jpeg({ quality: 84 }).toBuffer()
}

// ── CLI: render one sample per category ──
if (process.argv[2] === 'samples') {
  const OUT = path.join(__dir, '..', '_brandprev'); fs.mkdirSync(OUT, { recursive: true })
  const SAMP = {
    'scam-cybersecurity': ['FAKE PAYMENT', 'SCREENSHOT'],
    ai: ['AI IN TALENT', 'ACQUISITION'],
    business: ['GROWTH', 'STRATEGY 2026'],
    marketing: ['CONTENT THAT', 'CONVERTS'],
    science: ['BIOMATERIAL', 'BREAKTHROUGHS'],
    news: ['THE STORY', 'BEHIND THE DATA'],
    trustseal: ['VERIFY ANY', 'BUSINESS'],
  }
  for (const [cat, hl] of Object.entries(SAMP)) {
    const jpg = await generateFeatured({ category: cat, headline: hl })
    fs.writeFileSync(path.join(OUT, `sample-${cat}.jpg`), jpg)
    console.log('sample', cat, jpg.length + 'b')
  }
  console.log('done -> _brandprev/')
}
