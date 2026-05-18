#!/usr/bin/env node
/**
 * scripts/new-capture.mjs
 * Rapid capture CLI — generates a pre-filled MDX stub from a template.
 *
 * Usage:
 *   node scripts/new-capture.mjs <type> <slug>
 *
 * Types:
 *   failure     → content/failures/<slug>.mdx
 *   log         → content/logs/<date>-<slug>.mdx
 *   deployment  → content/logs/<date>-<slug>.mdx
 *   lab         → content/labs/<slug>.mdx
 *   case-study  → content/case-studies/<slug>.mdx
 *   playbook    → content/playbooks/<slug>.mdx
 *   workflow    → content/docs/<slug>.mdx
 *
 * Examples:
 *   node scripts/new-capture.mjs failure "vercel-oom-crash"
 *   node scripts/new-capture.mjs log "trustseal-may-ops"
 *   node scripts/new-capture.mjs lab "geo-structured-data-test"
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const TYPE_MAP = {
  failure:    { template: 'failure-report',    dir: 'failures',      prefix: false },
  log:        { template: 'execution-log',     dir: 'logs',          prefix: true  },
  deployment: { template: 'deployment-journal', dir: 'logs',         prefix: true  },
  lab:        { template: 'seo-experiment',    dir: 'labs',          prefix: false },
  'case-study': { template: 'case-study',      dir: 'case-studies',  prefix: false },
  playbook:   { template: 'ai-workflow',       dir: 'playbooks',     prefix: false },
  workflow:   { template: 'ai-workflow',       dir: 'docs',          prefix: false },
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

const [,, type, slug] = process.argv

if (!type || !slug) {
  console.error('Usage: node scripts/new-capture.mjs <type> <slug>')
  console.error('')
  console.error('Types: failure | log | deployment | lab | case-study | playbook | workflow')
  console.error('')
  console.error('Examples:')
  console.error('  node scripts/new-capture.mjs failure "vercel-oom-crash"')
  console.error('  node scripts/new-capture.mjs log "trustseal-may-review"')
  process.exit(1)
}

const config = TYPE_MAP[type]
if (!config) {
  console.error(`Unknown type: "${type}"`)
  console.error(`Valid types: ${Object.keys(TYPE_MAP).join(' | ')}`)
  process.exit(1)
}

const today       = new Date().toISOString().slice(0, 10)
const cleanSlug   = slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
const filename    = config.prefix ? `${today}-${cleanSlug}.mdx` : `${cleanSlug}.mdx`
const templatePath = path.join(ROOT, 'templates', `${config.template}.mdx`)
const outputDir   = path.join(ROOT, 'content', config.dir)
const outputPath  = path.join(outputDir, filename)

// Verify template exists
if (!fs.existsSync(templatePath)) {
  console.error(`Template not found: ${templatePath}`)
  process.exit(1)
}

// Verify output directory exists
if (!fs.existsSync(outputDir)) {
  console.error(`Content directory not found: ${outputDir}`)
  process.exit(1)
}

// Check output file doesn't already exist
if (fs.existsSync(outputPath)) {
  console.error(`File already exists: ${outputPath}`)
  console.error('Choose a different slug.')
  process.exit(1)
}

// Read template and replace placeholders
let content = fs.readFileSync(templatePath, 'utf8')
content = content.replace(/YYYY-MM-DD/g, today)

// Write output
fs.writeFileSync(outputPath, content, 'utf8')

// Output result
const relPath = path.relative(ROOT, outputPath).replace(/\\/g, '/')
console.log('')
console.log(`✓ Created: ${relPath}`)
console.log('')
console.log(`  Template:  templates/${config.template}.mdx`)
console.log(`  Section:   ${config.dir}`)
console.log(`  Date:      ${today}`)
console.log('')
console.log('Next steps:')
console.log('  1. Open the file and fill in the frontmatter')
console.log('  2. Write the content (30 min cap)')
console.log(`  3. git add content/${config.dir}/${filename}`)
console.log(`  4. git commit -m "content: ${type} — ${cleanSlug}"`)
console.log('  5. git push origin master')
console.log('')
