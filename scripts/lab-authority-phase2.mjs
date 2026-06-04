// One-off: add author frontmatter to all Lab articles, flag newest N as featured,
// and add a demo FAQ block. Idempotent — skips fields already present.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('content')
const SECTIONS = ['docs', 'systems', 'labs', 'case-studies', 'playbooks', 'failures', 'logs']
const AUTHOR = 'Anis Ansari'
const ROLE = 'Founder, A Square Solutions'
const FEATURED_COUNT = 6
const FAQ_DEMO_SLUG = 'multimodal-scamcheck'

function listMdx() {
  const files = []
  for (const s of SECTIONS) {
    const dir = path.join(ROOT, s)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.mdx') || f.endsWith('.md')) files.push({ section: s, slug: f.replace(/\.mdx?$/, ''), file: path.join(dir, f) })
    }
  }
  return files
}

function splitFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n)?/.exec(raw)
  if (!m) return null
  return { fm: m[1], rest: raw.slice(m[0].length), end: m[0].length }
}

function getDate(fm) {
  const m = /^date:\s*["']?([0-9]{4}-[0-9]{2}-[0-9]{2})/m.exec(fm)
  return m ? m[1] : '1970-01-01'
}

const files = listMdx()
let authorAdded = 0, dated = []

// Pass 1: add author + collect dates
for (const f of files) {
  let raw = fs.readFileSync(f.file, 'utf8')
  const parts = splitFrontmatter(raw)
  if (!parts) continue
  let fm = parts.fm
  if (!/^author:/m.test(fm)) {
    fm = `author: ${AUTHOR}\nauthor_role: ${ROLE}\n` + fm
    authorAdded++
  }
  raw = `---\n${fm}\n---\n${parts.rest.replace(/^\r?\n/, '')}`
  fs.writeFileSync(f.file, raw)
  dated.push({ ...f, date: getDate(fm) })
}

// Pass 2: featured = newest N
dated.sort((a, b) => b.date.localeCompare(a.date))
const featuredSet = new Set(dated.slice(0, FEATURED_COUNT).map((d) => d.file))
let featuredAdded = 0
for (const f of dated) {
  if (!featuredSet.has(f.file)) continue
  let raw = fs.readFileSync(f.file, 'utf8')
  const parts = splitFrontmatter(raw)
  if (!parts) continue
  let fm = parts.fm
  if (!/^featured:/m.test(fm)) {
    fm = `featured: true\n` + fm
    featuredAdded++
  }
  fs.writeFileSync(f.file, `---\n${fm}\n---\n${parts.rest.replace(/^\r?\n/, '')}`)
}

// Pass 3: demo FAQ on one doc
let faqAdded = 0
const faqFile = path.join(ROOT, 'docs', `${FAQ_DEMO_SLUG}.mdx`)
if (fs.existsSync(faqFile)) {
  let raw = fs.readFileSync(faqFile, 'utf8')
  const parts = splitFrontmatter(raw)
  if (parts && !/^faqs:/m.test(parts.fm)) {
    const faqBlock = [
      'faqs:',
      '  - question: What is multimodal ScamCheck?',
      '    answer: It analyses screenshots and images for scams using OCR, AI vision, and semantic retrieval against known scam campaigns.',
      '  - question: Are uploaded screenshots stored?',
      '    answer: No. Images are optimised on-device and processed in-request; they are not stored.',
    ].join('\n')
    const fm = `${faqBlock}\n${parts.fm}`
    fs.writeFileSync(faqFile, `---\n${fm}\n---\n${parts.rest.replace(/^\r?\n/, '')}`)
    faqAdded++
  }
}

console.log(JSON.stringify({ totalFiles: files.length, authorAdded, featuredAdded, faqAdded, featured: dated.slice(0, FEATURED_COUNT).map((d) => `${d.section}/${d.slug}`) }, null, 2))
