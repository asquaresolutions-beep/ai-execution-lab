#!/usr/bin/env node
// scripts/wp/plan-blog-growth.mjs — asq-growth-wp-v1
// Plans (and, only when explicitly authorized, applies) the WordPress-side
// newsletter growth system on the A Square Solutions blog:
//   (1) inject the embeddable scam-alert signup block into target posts, and
//   (3) add contextual internal links from each post to the matching ScamCheck
//       checker (reciprocal of lib/scamcheck/blog-resources.ts).
//
// SAFETY: DRY-RUN BY DEFAULT. Modifying the live public blog is a publish action
// and requires explicit owner approval. The live path runs ONLY when ALL of:
//   env WP_BASE, WP_USER, WP_APP_PASSWORD are set  AND  flags --apply --confirm
// are passed. Otherwise it just prints the plan. A per-run JSON backup of each
// edited post is written to scripts/wp/backups/ before any update.
//
// Run (dry-run):  node --experimental-strip-types scripts/wp/plan-blog-growth.mjs
// Run (live):     WP_BASE=… WP_USER=… WP_APP_PASSWORD=… node --experimental-strip-types \
//                   scripts/wp/plan-blog-growth.mjs --apply --confirm
import fs from 'node:fs'
import path from 'node:path'
import { BLOG_RESOURCES } from '../../lib/scamcheck/blog-resources.ts'

const SCAMCHECK = 'https://scamcheck.asquaresolution.com'
const EMBED_SRC = `${SCAMCHECK}/embed/scam-alert.js`
const MARK_LINKS = 'asq-growth-links-v1'
const MARK_NL = 'asq-growth-cta-v1'

// Map each ScamCheck checker slug → a human anchor + URL for the in-post link.
const CHECKER_LINK = {
  'whatsapp-scam-checker': 'WhatsApp Scam Checker',
  'sms-scam-checker': 'SMS Scam Checker',
  'upi-scam-checker': 'UPI Scam Checker',
  'email-scam-checker': 'Email Scam Checker',
  'phone-scam-checker': 'Phone Scam Checker',
  'link-scam-checker': 'Link / URL Scam Checker',
  'screenshot-scam-checker': 'Screenshot Scam Checker',
}

/** The reciprocal plan: for each blog post (by slug), which ScamCheck links to add. */
function buildPlan() {
  return BLOG_RESOURCES.map((r) => {
    const checkers = r.relevantTo.filter((s) => CHECKER_LINK[s]).slice(0, 2)
    const links = checkers.map((s) => ({ slug: s, anchor: CHECKER_LINK[s], url: `${SCAMCHECK}/${s}` }))
    return { postSlug: r.slug, postTitle: r.title, links }
  })
}

/** HTML appended to a post body: contextual ScamCheck links + the scam-alert embed. */
function blockHtml(plan) {
  const linkList = plan.links
    .map((l) => `<li><a href="${l.url}" rel="noopener">${l.anchor}</a> — check a suspicious message free.</li>`)
    .join('')
  return [
    `<!-- ${MARK_LINKS} -->`,
    `<aside class="asq-related"><p><strong>Check it yourself — free:</strong></p><ul>${linkList}</ul></aside>`,
    `<!-- /${MARK_LINKS} -->`,
    `<!-- ${MARK_NL} -->`,
    `<div data-scamcheck-alert data-source="blog:${plan.postSlug}" style="min-height:188px"></div>`,
    `<script src="${EMBED_SRC}" defer></script>`,
    `<!-- /${MARK_NL} -->`,
  ].join('\n')
}

function printPlan(plan) {
  console.log('\nA Square Solutions — blog newsletter growth plan (DRY-RUN unless --apply --confirm)\n')
  for (const p of plan) {
    console.log(`• ${p.postSlug}`)
    console.log(`    + scam-alert signup block  (source="blog:${p.postSlug}")`)
    for (const l of p.links) console.log(`    + link → ${l.url}  ("${l.anchor}")`)
  }
  console.log(`\n${plan.length} posts planned · markers: ${MARK_LINKS}, ${MARK_NL}`)
}

// ── WordPress REST helpers (only used on the live path) ───────────────────────
function wpAuthHeader() {
  const t = Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64')
  return `Basic ${t}`
}
async function wpGetPostBySlug(slug) {
  const u = `${process.env.WP_BASE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&context=edit&_fields=id,slug,content,title`
  const r = await fetch(u, { headers: { Authorization: wpAuthHeader() } })
  if (!r.ok) throw new Error(`GET ${slug} → ${r.status}`)
  const arr = await r.json()
  return arr[0] || null
}
async function wpUpdatePost(id, content) {
  const r = await fetch(`${process.env.WP_BASE}/wp-json/wp/v2/posts/${id}`, {
    method: 'POST',
    headers: { Authorization: wpAuthHeader(), 'content-type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!r.ok) throw new Error(`UPDATE ${id} → ${r.status}`)
  return r.json()
}

async function applyPlan(plan) {
  const backupDir = path.join('scripts', 'wp', 'backups', new Date().toISOString().replace(/[:.]/g, '-'))
  fs.mkdirSync(backupDir, { recursive: true })
  let edited = 0, skipped = 0
  for (const p of plan) {
    const post = await wpGetPostBySlug(p.postSlug)
    if (!post) { console.log(`  ! ${p.postSlug}: not found — skipped`); skipped++; continue }
    const raw = (post.content && post.content.raw) || ''
    if (raw.includes(MARK_NL) || raw.includes(MARK_LINKS)) { console.log(`  = ${p.postSlug}: already has growth block — skipped`); skipped++; continue }
    fs.writeFileSync(path.join(backupDir, `${post.id}-${p.postSlug}.html`), raw)
    await wpUpdatePost(post.id, raw + '\n' + blockHtml(p))
    console.log(`  ✓ ${p.postSlug}: block + ${p.links.length} link(s) added (backup saved)`) ; edited++
  }
  console.log(`\nApplied. edited=${edited} skipped=${skipped} · backups in ${backupDir}`)
}

// Exported for tests.
export { buildPlan, blockHtml, CHECKER_LINK }

// ── main (only when run directly, not when imported by tests) ────────────────
if (import.meta.main) {
  const args = new Set(process.argv.slice(2))
  const plan = buildPlan()
  printPlan(plan)

  const wantApply = args.has('--apply') && args.has('--confirm')
  const haveCreds = process.env.WP_BASE && process.env.WP_USER && process.env.WP_APP_PASSWORD
  if (!wantApply) {
    console.log('\n(dry-run) Re-run with WP_BASE/WP_USER/WP_APP_PASSWORD env + flags --apply --confirm to apply live.')
  } else if (!haveCreds) {
    console.error('\nRefusing to apply: WP_BASE / WP_USER / WP_APP_PASSWORD must all be set.')
    process.exit(2)
  } else {
    console.log('\nApplying to live WordPress…')
    await applyPlan(plan)
  }
}
