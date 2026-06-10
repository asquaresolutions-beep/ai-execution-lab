#!/usr/bin/env node
// Tests for the P1 deliverability changes (asq-deliverability-p1).
// Unit-tests the real htmlToText (type-stripping), then static-asserts the
// header/footer/text wiring in notify.ts + the unsubscribe route.
// Run: node --experimental-strip-types scripts/test-email-deliverability.mjs
import fs from 'node:fs'
import { htmlToText } from '../lib/email/text.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── htmlToText (real function) ──
const t = htmlToText('<h2>Hi</h2><p>Visit <a href="https://x.io">our site</a> &amp; relax.</p><p>Pay &#8377;149</p>')
ok('strips tags', !/[<][a-z/]/i.test(t.replace(/<https?:[^>]+>/g, '')))
ok('keeps link text + url', /our site \(https:\/\/x\.io\)/.test(t))
ok('decodes &amp;', /& relax/.test(t))
ok('decodes rupee entity', t.includes('₹149'))
ok('paragraphs become newlines', /Hi\n/.test(t))
ok('non-empty plaintext', t.length > 10)

// ── notify.ts wiring ──
const n = read('lib/email/notify.ts')
ok('send() accepts text + headers', /text\?: string/.test(n) && /headers\?: Record<string, string>/.test(n))
ok('send() always derives a text part', /const text = opts\.text \|\| htmlToText\(opts\.html\)/.test(n))
ok('send() passes text + headers to Resend', /html: opts\.html, text,/.test(n) && /\.\.\.\(opts\.headers \? \{ headers: opts\.headers \}/.test(n))
ok('List-Unsubscribe header built', /'List-Unsubscribe':/.test(n))
ok('one-click List-Unsubscribe-Post header', /'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'/.test(n))
ok('unsubscribe URL helper exported', /export function unsubscribeUrl/.test(n))
ok('in-body unsubscribe link + postal address footer', /function unsubFooter/.test(n) && /MAIL_PHYSICAL_ADDRESS/.test(n))
// applied to all three LIST emails, and NOT to transactional lead/contact mail
ok('newsletter welcome has unsub headers+footer', /Welcome to the A Square Solutions newsletter[\s\S]*?headers: listHeaders\(d\.email\)[\s\S]*?unsubFooter\(d\.email\)/.test(n))
ok('lab welcome has unsub headers+footer', /Welcome to AI Execution Lab Weekly[\s\S]*?headers: listHeaders\(d\.email\)[\s\S]*?unsubFooter\(d\.email\)/.test(n))
ok('scam-alert welcome has unsub headers+footer', /subscribed to ScamCheck alerts[\s\S]*?headers: listHeaders\(email\)[\s\S]*?unsubFooter\(email\)/.test(n))
ok('lead/contact transactional mail NOT given list-unsub (3 list call-sites only)', (n.match(/listHeaders\((d\.email|email)\)/g) || []).length === 3)
// branding untouched
ok('branding wrappers unchanged', /ScamCheck · A Square Solutions/.test(n) && /color:#6366f1/.test(n))

// ── unsubscribe route ──
const r = read('app/api/newsletter/unsubscribe/route.ts')
ok('route has GET + POST', /export async function GET/.test(r) && /export async function POST/.test(r))
ok('POST returns 200 on success (one-click)', /status: ok \? 200 : 400/.test(r))
ok('non-destructive (sets unsubscribed flag, no delete)', /unsubscribed: true/.test(r) && !/\.delete\(/.test(r))
ok('only updates existing docs (no stray creates)', /const doc = await store\.get(<[^>]*>)?\(c, id\)/.test(r) && /if \(doc\)/.test(r))

console.log(`\nemail-deliverability: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
