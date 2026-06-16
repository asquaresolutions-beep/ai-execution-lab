#!/usr/bin/env node
// Structural validation of the vendored QR encoder (lib/trustseal/qr.ts). It has
// no @/ imports, so it runs directly. We can't fully prove scannability without a
// decoder, but we assert the invariants a malformed encoder would violate:
// version sizing, finder patterns, timing patterns, dark module, quiet-zone SVG,
// and that the format-info modules read back to ECC-L / mask 0.
// Run: node --experimental-strip-types scripts/test-trustseal-qr.mjs
import { qrEncode, qrSvg } from '../lib/trustseal/qr.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }

const url = 'https://trustseal.asquaresolution.com/en/trust/asquaresolution.com'
const qr = qrEncode(url)
ok('encodes a seal URL (non-null)', !!qr)
if (qr) {
  ok('size is 17+4v and odd-ish (v1-5 → 21..41)', qr.size >= 21 && qr.size <= 41 && (qr.size - 17) % 4 === 0)
  const m = qr.modules
  // finder pattern top-left: corner dark, inner light ring, 3x3 dark core
  ok('finder TL: corner dark', m[0][0] === true)
  ok('finder TL: ring gap light', m[1][1] === false)
  ok('finder TL: 3x3 core dark', m[2][2] && m[3][3] && m[4][4])
  // finder top-right + bottom-left present
  ok('finder TR present', m[0][qr.size - 1] === true && m[0][qr.size - 7] === true)
  ok('finder BL present', m[qr.size - 1][0] === true && m[qr.size - 7][0] === true)
  // timing pattern row 6 alternates (between the finders)
  let timingOk = true
  for (let c = 8; c < qr.size - 8; c++) if (m[6][c] !== (c % 2 === 0)) timingOk = false
  ok('timing pattern row 6 alternates', timingOk)
  // dark module
  const v = (qr.size - 17) / 4
  ok('dark module set at (4v+9, 8)', m[4 * v + 9][8] === true)
  // format-info read-back: bits at (8,0..5) should match ECC-L/mask0 format = 0x77C4
  const FORMAT = 0b111011111000100 // L, mask 0 (QR spec table)
  const fmtBits = []
  for (let i = 14; i >= 0; i--) fmtBits.push((FORMAT >> i) & 1)
  let fmtOk = true
  for (let i = 0; i <= 5; i++) if ((m[8][i] ? 1 : 0) !== fmtBits[i]) fmtOk = false
  if ((m[8][7] ? 1 : 0) !== fmtBits[6]) fmtOk = false
  if ((m[8][8] ? 1 : 0) !== fmtBits[7]) fmtOk = false
  if ((m[7][8] ? 1 : 0) !== fmtBits[8]) fmtOk = false
  ok('format info encodes ECC-L + mask 0 (0x77C4)', fmtOk)
  // SVG renders with quiet zone
  const svg = qrSvg(qr)
  ok('qrSvg outputs an <svg> with rects', svg.startsWith('<svg') && svg.includes('<rect'))
}
// capacity guard: an oversized string returns null (doesn't silently truncate)
ok('oversized input → null (no truncation)', qrEncode('x'.repeat(200)) === null)

console.log(`\nQR encoder tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
