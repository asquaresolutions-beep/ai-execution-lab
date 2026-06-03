#!/usr/bin/env node
/**
 * scripts/linkedin-post-lab-launch.mjs
 *
 * Publishes the AI Execution Lab launch post to LinkedIn.
 *
 * Token is read from .env.local — never from arguments or hardcoded values.
 *
 * Usage:
 *   node scripts/linkedin-post-lab-launch.mjs [--dry-run]
 *
 * Flags:
 *   --dry-run   Preview post content without publishing
 *   --validate  Validate token and show profile only (no post)
 */

import readline from 'readline'
import { loadToken, getProfile, publishPost } from './linkedin-util.mjs'

// ─────────────────────────────────────────────────────────────────────────────
// Post content
// ─────────────────────────────────────────────────────────────────────────────

const POST = `We built a public record of how we actually build AI systems.

Not tutorials. An operational record.

AI Execution Lab (lab.asquaresolution.com) is A Square Solutions' engineering journal — covering production failures, deployment workflows, debugging sessions, and the Claude Code operator workflows that run our products.

What's inside:

→ 12 production failure reports with exact error messages, root causes, and resolution times

→ One example: Vercel deployment blocked for 23 minutes on 2026-05-10 because opengraph-image.tsx had \`export const runtime = 'edge'\` — which doesn't support Node.js crypto. The exact error, the exact fix, and the timeline are documented publicly.

→ Deployment and debugging journals from real sessions — written during the work, not reconstructed after

→ Full Claude Code operator track — the actual AI-assisted workflows we use to build and operate production systems

→ The same execution tracks that run TrustSeal (AI trust verification — trustseal.asquaresolution.com) and ScamCheck (AI scam detection — scamcheck.asquaresolution.com)

The platform operates on one principle: build first, document second. No speculative content. No tutorials for things we haven't done. No success theater.

313 published URLs at launch. 12 scored production failures. 100% sitemap pass rate.

If you build AI systems and want a public record of how the work actually goes — this is the platform.

→ lab.asquaresolution.com

#AIEngineering #ClaudeCode #BuildInPublic #NextJS #Vercel #OperationalAI #GEO #SEO`

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

function printDivider() {
  console.log('\n' + '─'.repeat(60) + '\n')
}

function printPreview(displayName) {
  printDivider()
  console.log('POST PREVIEW')
  console.log(`Author: ${displayName}`)
  console.log(`Characters: ${POST.length}`)
  printDivider()
  console.log(POST)
  printDivider()
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const isDryRun   = process.argv.includes('--dry-run')
  const isValidate = process.argv.includes('--validate')

  console.log('\n[linkedin-post-lab-launch] Starting...')
  console.log('Token source: .env.local (LINKEDIN_ACCESS_TOKEN)')

  // Step 1: Load token from .env.local
  let token
  try {
    token = loadToken()
    console.log('✓ Token loaded from .env.local')
  } catch (err) {
    console.error('\n✗ Token error:', err.message)
    process.exit(1)
  }

  // Step 2: Validate token and get profile
  console.log('\nValidating token with LinkedIn API...')
  let profile
  try {
    profile = await getProfile(token)
    console.log(`✓ Token valid`)
    console.log(`  Name:   ${profile.displayName}`)
    console.log(`  URN:    ${profile.authorUrn}`)
  } catch (err) {
    console.error('\n✗ Token validation failed:', err.message)
    console.error('\nIf the token expired, generate a new one and update .env.local.')
    process.exit(1)
  }

  if (isValidate) {
    console.log('\n✓ Validation complete. Exiting (--validate flag set).')
    process.exit(0)
  }

  // Step 3: Preview
  printPreview(profile.displayName)

  if (isDryRun) {
    console.log('DRY RUN — no post published (--dry-run flag set).')
    console.log(`Post length: ${POST.length} characters`)
    process.exit(0)
  }

  // Step 4: Confirm
  const answer = await prompt('Publish this post to LinkedIn? [yes/no]: ')
  if (answer !== 'yes' && answer !== 'y') {
    console.log('\nAborted. No post was published.')
    process.exit(0)
  }

  // Step 5: Publish
  console.log('\nPublishing...')
  let result
  try {
    result = await publishPost(token, profile.authorUrn, POST)
    console.log('\n✓ Post published successfully')
    console.log(`  Post URL: ${result.postUrl}`)
    if (result.postUrn) {
      console.log(`  Post URN: ${result.postUrn}`)
    }
  } catch (err) {
    console.error('\n✗ Publish failed:', err.message)
    process.exit(1)
  }

  // Step 6: Post-publish log
  console.log('\n─────────────────────────────────────────────────────────────')
  console.log('POST-PUBLISH CHECKLIST')
  console.log('─────────────────────────────────────────────────────────────')
  console.log('[ ] Open LinkedIn feed and verify post is visible')
  console.log('[ ] Confirm hashtags are not truncated')
  console.log('[ ] Verify lab.asquaresolution.com link resolves')
  console.log('[ ] Verify trustseal and scamcheck links resolve')
  console.log(`[ ] Bookmark post URL: ${result.postUrl}`)
  console.log('[ ] Note post time for GSC/analytics correlation')
  console.log('─────────────────────────────────────────────────────────────\n')
}

run().catch(err => {
  console.error('[linkedin-post-lab-launch] FATAL:', err.message)
  process.exit(1)
})
