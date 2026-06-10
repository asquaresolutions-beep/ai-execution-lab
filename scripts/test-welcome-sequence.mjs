#!/usr/bin/env node
// Tests for the welcome drip (asq-welcome-seq-v1). Unit-tests the pure copy +
// due-step logic (real functions, type-stripped) and static-asserts the cron
// wiring + the disabled-by-default safety gate.
// Run: node --experimental-strip-types scripts/test-welcome-sequence.mjs
import fs from 'node:fs'
import { WELCOME_STEPS, MAX_WELCOME_STEP, DAY_MS, welcomeEmail, dueWelcomeStep } from '../lib/newsletter/welcome-copy.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const NOW = Date.parse('2026-06-10T00:00:00Z')
const ago = (days) => new Date(NOW - days * DAY_MS).toISOString()

// ── step definitions ──
ok('3 drip steps after Day-0', WELCOME_STEPS.length === 3 && MAX_WELCOME_STEP === 3)
ok('offsets are Day 2/5/9', WELCOME_STEPS.map((s) => s.offsetDays).join(',') === '2,5,9')

// ── copy builders ──
for (const s of [1, 2, 3]) {
  const m = welcomeEmail(s, 'Asha')
  ok(`step ${s} has subject/title/body`, !!m && !!m.subject && !!m.title && m.bodyHtml.length > 50)
  ok(`step ${s} greets by name`, m.bodyHtml.includes('Asha'))
}
ok('step 1 = scam awareness', /scam/i.test(welcomeEmail(1).bodyHtml))
ok('step 2 = ScamCheck tutorial', /scamcheck\.asquaresolution\.com/.test(welcomeEmail(2).bodyHtml))
ok('step 3 = TrustSeal + Lab', /TrustSeal/.test(welcomeEmail(3).bodyHtml) && /lab\.asquaresolution\.com/.test(welcomeEmail(3).bodyHtml))
ok('name is HTML-escaped', welcomeEmail(1, '<b>x</b>').bodyHtml.includes('&lt;b&gt;'))
ok('unknown step → null', welcomeEmail(4) === null && welcomeEmail(0) === null)

// ── dueWelcomeStep logic ──
ok('fresh signup (0d): nothing due', dueWelcomeStep({ createdAt: ago(0), welcomeStep: 0 }, NOW) === null)
ok('1d: still nothing (Day2 not reached)', dueWelcomeStep({ createdAt: ago(1), welcomeStep: 0 }, NOW) === null)
ok('2d, step0 → step1 due', dueWelcomeStep({ createdAt: ago(2), welcomeStep: 0 }, NOW) === 1)
ok('5d, step1 → step2 due', dueWelcomeStep({ createdAt: ago(5), welcomeStep: 1 }, NOW) === 2)
ok('9d, step2 → step3 due', dueWelcomeStep({ createdAt: ago(9), welcomeStep: 2 }, NOW) === 3)
ok('one step per run (10d, step1 → only step2)', dueWelcomeStep({ createdAt: ago(10), welcomeStep: 1 }, NOW) === 2)
ok('completed (step3) → null', dueWelcomeStep({ createdAt: ago(30), welcomeStep: 3 }, NOW) === null)
ok('unsubscribed → null', dueWelcomeStep({ createdAt: ago(9), welcomeStep: 0, unsubscribed: true }, NOW) === null)
ok('missing/invalid createdAt → null', dueWelcomeStep({ welcomeStep: 0 }, NOW) === null)
ok('welcomeStep defaults to 0', dueWelcomeStep({ createdAt: ago(3) }, NOW) === 1)

// ── orchestration safety + cron wiring (static) ──
const seq = read('lib/newsletter/welcome-sequence.ts')
ok('disabled unless WELCOME_SEQUENCE_ENABLED===true', /WELCOME_SEQUENCE_ENABLED !== 'true'/.test(seq))
ok('uses existing newsletter collection', /query<[^>]*>\('newsletter'/.test(seq) || /'newsletter'/.test(seq))
ok('advances welcomeStep only on confirmed send', /if \(r\.ok\)[\s\S]*welcomeStep: step/.test(seq))
ok('no delete of subscriber data', !/\.delete\(/.test(seq))

const dq = read('app/api/cron/drain-queue/route.ts')
ok('cron calls processWelcomeSequence', /await processWelcomeSequence\(\)/.test(dq))
ok('welcome phase isolated in try/catch (warning)', /cron\.welcome_sequence[\s\S]*severity: 'warning'/.test(dq) || /processWelcomeSequence\(\)[\s\S]*catch/.test(dq))

const notify = read('lib/email/notify.ts')
ok('sendListEmail applies list headers + unsub footer', /export async function sendListEmail[\s\S]*listHeaders\(d\.to\)[\s\S]*unsubFooter\(d\.to\)/.test(notify))

console.log(`\nwelcome-sequence: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
