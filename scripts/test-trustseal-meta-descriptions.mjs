#!/usr/bin/env node
// Tests for the English meta descriptions on TrustSeal /en/docs and /en/about.
// The content modules only import types, so they load directly; page wiring and the
// shared metadata builder are checked as static source assertions (like the other
// TrustSeal suites). Run: node scripts/test-trustseal-meta-descriptions.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const { docsContent } = await import('../lib/trustseal/content/docs.ts')
const { aboutContent } = await import('../lib/trustseal/content/about.ts')

const DOCS_META = 'TrustSeal docs: verify domain ownership with a DNS TXT record, add the trust badge script, understand the 0–100 trust score, and use the public Trust API.'
const ABOUT_META = 'About TrustSeal: a product by A Square Solutions that turns domain ownership and reputation signals into a verifiable trust score, badge and public seal page.'

// A. /en/docs
ok('docs: en metaDescription is the approved text', docsContent.en.metaDescription === DOCS_META)
ok('docs: approved text is 154 characters', [...DOCS_META].length === 154)
ok('docs: en title unchanged', docsContent.en.title === 'Documentation')
ok('docs: en visible subtitle unchanged', docsContent.en.subtitle === 'Everything you need to verify a domain, publish your trust badge, and understand the trust score.')

// B. /en/about
ok('about: en metaDescription is the approved text', aboutContent.en.metaDescription === ABOUT_META)
ok('about: approved text is 158 characters', [...ABOUT_META].length === 158)
ok('about: en title unchanged', aboutContent.en.title === 'About TrustSeal')
ok('about: en visible subtitle unchanged', aboutContent.en.subtitle === 'Verifiable business trust for an internet where anyone can claim to be anyone.')

// C. other locales keep subtitle-derived metadata
for (const lc of ['hi', 'es', 'ar']) {
  ok(`docs: ${lc} has no metaDescription (falls back to subtitle)`, docsContent[lc].metaDescription === undefined && !!docsContent[lc].subtitle)
  ok(`about: ${lc} has no metaDescription (falls back to subtitle)`, aboutContent[lc].metaDescription === undefined && !!aboutContent[lc].subtitle)
}

// Page wiring: metadata prefers metaDescription, the rendered page still uses the full content (subtitle)
for (const page of ['docs', 'about']) {
  const src = code(read(`app/trustseal/[locale]/${page}/page.tsx`))
  ok(`${page}: generateMetadata uses metaDescription ?? subtitle`, /description:\s*p\.metaDescription\s*\?\?\s*p\.subtitle/.test(src))
  ok(`${page}: title construction unchanged`, /title:\s*`\$\{p\.title\} — TrustSeal`/.test(src))
  ok(`${page}: still indexable`, /index:\s*true/.test(src))
}
ok('content-page: visible subtitle still renders page.subtitle', /\{page\.subtitle\}/.test(read('components/trustseal/content-page.tsx')))

// D. no other TrustSeal page opts into metaDescription
const others = ['security', 'pricing', 'verify', 'trust-center', 'customers', 'enterprise', 'product', 'command', 'dashboard']
ok('no other TrustSeal page reads metaDescription', others.every((p) => { try { return !/metaDescription/.test(read(`app/trustseal/[locale]/${p}/page.tsx`)) } catch { return true } }) && !/metaDescription/.test(read('app/trustseal/[locale]/page.tsx')))
ok('security content sets no metaDescription', !/metaDescription/.test(read('lib/trustseal/content/security.ts')))

// E. shared buildTrustMeta unchanged: description passes straight through to meta, OG and Twitter
const seo = code(read('lib/trustseal/seo.ts'))
ok('buildTrustMeta: description passthrough', /description:\s*opts\.description,/.test(seo))
ok('buildTrustMeta: OG + Twitter use opts.description', (seo.match(/description:\s*opts\.description/g) || []).length === 3)
ok('buildTrustMeta: no metaDescription knowledge', !/metaDescription/.test(seo))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
