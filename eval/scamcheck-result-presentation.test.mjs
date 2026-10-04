// eval/scamcheck-result-presentation.test.mjs  (Fix 8A characterisation)
//
// Pins the CURRENT result-card presentation (styles, labels, share text) after
// moving it into lib/scamcheck/result-presentation.ts. No behaviour change.
//
// Run: node --test --import ./eval/hooks.mjs eval/scamcheck-result-presentation.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const P = await import(pathToFileURL(B + 'lib/scamcheck/result-presentation.ts').href)
const SITE = 'https://scamcheck.asquaresolution.com'

test('8A: styles identical to the previous inline maps', () => {
  assert.equal(P.verdictStyle('likely_scam'), 'bg-red-500/15 text-red-300 border-red-500/40')
  assert.equal(P.verdictStyle('suspicious'), 'bg-amber-500/15 text-amber-300 border-amber-500/40')
  assert.equal(P.verdictStyle('likely_safe'), 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40')
  assert.equal(P.verdictStyle('unclear'), 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40')
  assert.equal(P.verdictStyle('needs_review'), 'bg-sky-500/15 text-sky-300 border-sky-500/40')
})
test('8A: labels identical (underscores → spaces)', () => {
  assert.equal(P.verdictLabel('likely_safe'), 'likely safe')
  assert.equal(P.verdictLabel('needs_review'), 'needs review')
})
test('8A: share summary identical', () => {
  assert.equal(P.buildShareSummary({ verdict: 'unclear', riskScore: 6, category: 'other' }, SITE),
    'ScamCheck result: unclear (risk 6/100) — other. Checked free at https://scamcheck.asquaresolution.com/scamcheck')
  assert.equal(P.buildShareSummary({ verdict: 'likely_scam', riskScore: 72, category: 'otp_fraud' }, SITE),
    'ScamCheck result: likely scam (risk 72/100) — otp fraud. Checked free at https://scamcheck.asquaresolution.com/scamcheck')
})
test('8A: trusted note identical', () => {
  assert.equal(P.TRUSTED_NOTE, 'Matches a verified/official entity — likely legitimate (still verify in the official app).')
})
