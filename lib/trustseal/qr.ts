// ─────────────────────────────────────────────────────────────────
// lib/trustseal/qr.ts  (asq-trustseal-phase3)
// Minimal, dependency-free QR encoder for certificate verification URLs.
// Scope (kept deliberately small for correctness): byte mode, ECC level L,
// single block, versions 1–5 (capacity 19→108 bytes — ample for a seal URL),
// fixed mask 0. A fixed mask is spec-compliant: decoders read the mask from the
// format-info bits and invert it, so any correctly-encoded mask scans. Returns a
// boolean module matrix (true = dark); render to SVG with qrSvg().
// ─────────────────────────────────────────────────────────────────

// ── GF(256), primitive poly 0x11d ──
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function rsGenerator(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= mul(poly[j], EXP[i])
      next[j + 1] ^= poly[j]
    }
    poly = next
  }
  return poly
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen)
  const res = new Array(ecLen).fill(0)
  for (const d of data) {
    const factor = d ^ res[0]
    res.shift()
    res.push(0)
    for (let j = 0; j < ecLen; j++) res[j] ^= mul(gen[j], factor)
  }
  return res
}

// version → { totalCodewords, ecCodewords } at ECC-L, single block.
const SPEC: Record<number, { total: number; ec: number; align: number | null }> = {
  1: { total: 26, ec: 7, align: null },
  2: { total: 44, ec: 10, align: 18 },
  3: { total: 70, ec: 15, align: 22 },
  4: { total: 100, ec: 20, align: 26 },
  5: { total: 134, ec: 26, align: 30 },
}

export interface QrMatrix { size: number; modules: boolean[][] }

/** Encode `text` (UTF-8 bytes) to a QR matrix, or null if it doesn't fit v1–5/L. */
export function qrEncode(text: string): QrMatrix | null {
  const bytes = Array.from(new TextEncoder().encode(text))
  // pick smallest version whose data capacity fits
  let version = 0
  for (let v = 1; v <= 5; v++) {
    const dataCap = SPEC[v].total - SPEC[v].ec
    // 4 (mode) + 8 (length, byte mode v1-9) + 8*len + 4 (terminator) bits → bytes
    const needBits = 4 + 8 + bytes.length * 8
    if (needBits + 4 <= dataCap * 8) { version = v; break }
  }
  if (!version) return null

  const { total, ec, align } = SPEC[version]
  const dataCap = total - ec

  // ── bitstream ──
  const bits: number[] = []
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1) }
  push(0b0100, 4) // byte mode
  push(bytes.length, 8) // char count (v1-9)
  for (const b of bytes) push(b, 8)
  // terminator (≤4 bits) + pad to byte boundary
  const cap = dataCap * 8
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)
  // pad bytes
  const dataCodewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]
    dataCodewords.push(b)
  }
  const PAD = [0xec, 0x11]
  let pi = 0
  while (dataCodewords.length < dataCap) dataCodewords.push(PAD[pi++ % 2])

  const ecCodewords = rsEncode(dataCodewords, ec)
  const all = [...dataCodewords, ...ecCodewords]

  // ── matrix ──
  const size = 17 + 4 * version
  const m: (boolean | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null))
  const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false)) // function module?

  const setFn = (r: number, c: number, v: boolean) => { m[r][c] = v; fn[r][c] = true }

  // finder + separator
  const finder = (R: number, C: number) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = R + r, cc = C + c
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue
      const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
      setFn(rr, cc, inRing)
    }
  }
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0)

  // timing
  for (let i = 8; i < size - 8; i++) {
    const v = i % 2 === 0
    if (!fn[6][i]) setFn(6, i, v)
    if (!fn[i][6]) setFn(i, 6, v)
  }

  // alignment pattern (single, v2-5)
  if (align != null) {
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
      const inRing = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)
      setFn(align + r, align + c, inRing)
    }
  }

  // dark module
  setFn(4 * version + 9, 8, true)

  // reserve format-info areas (filled later)
  const reserveFormat = () => {
    for (let i = 0; i <= 8; i++) { if (!fn[8][i]) { m[8][i] = false; fn[8][i] = true } if (!fn[i][8]) { m[i][8] = false; fn[i][8] = true } }
    for (let i = 0; i < 8; i++) { if (!fn[8][size - 1 - i]) { m[8][size - 1 - i] = false; fn[8][size - 1 - i] = true } if (!fn[size - 1 - i][8]) { m[size - 1 - i][8] = false; fn[size - 1 - i][8] = true } }
  }
  reserveFormat()

  // ── data placement (zigzag, fixed mask 0: (r+c)%2===0) ──
  let bitIdx = 0
  const dataBits: number[] = []
  for (const cw of all) for (let i = 7; i >= 0; i--) dataBits.push((cw >> i) & 1)

  let upward = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col-- // skip vertical timing column
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i
      for (let c = 0; c < 2; c++) {
        const cc = col - c
        if (fn[row][cc]) continue
        let bit = bitIdx < dataBits.length ? dataBits[bitIdx] : 0
        bitIdx++
        if ((row + cc) % 2 === 0) bit ^= 1 // mask 0
        m[row][cc] = bit === 1
      }
    }
    upward = !upward
  }

  // ── format info (ECC-L = 01, mask 0 = 000) ──
  const fmtData = 0b01000 // 5 bits: level(01) + mask(000)
  let rem = fmtData
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) ? 0b10100110111 : 0)
  let fmt = ((fmtData << 10) | rem) ^ 0b101010000010010
  const fmtBits: number[] = []
  for (let i = 14; i >= 0; i--) fmtBits.push((fmt >> i) & 1)
  // place (standard positions)
  const place = (r: number, c: number, b: number) => { m[r][c] = b === 1 }
  for (let i = 0; i <= 5; i++) place(8, i, fmtBits[i])
  place(8, 7, fmtBits[6]); place(8, 8, fmtBits[7]); place(7, 8, fmtBits[8])
  for (let i = 9; i <= 14; i++) place(14 - i, 8, fmtBits[i])
  for (let i = 0; i <= 7; i++) place(size - 1 - i, 8, fmtBits[i])
  for (let i = 8; i <= 14; i++) place(8, size - 15 + i, fmtBits[i])

  const out: boolean[][] = m.map((row) => row.map((v) => v === true))
  return { size, modules: out }
}

/** Render a QR matrix to an inline SVG string (with a quiet zone). */
export function qrSvg(qr: QrMatrix, opts: { size?: number; dark?: string; light?: string } = {}): string {
  const quiet = 4
  const dim = qr.size + quiet * 2
  const px = opts.size ?? 220
  const dark = opts.dark ?? '#0b0f17'
  const light = opts.light ?? '#ffffff'
  let rects = ''
  for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) {
    if (qr.modules[r][c]) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${dim}" height="${dim}" fill="${light}"/><g fill="${dark}">${rects}</g></svg>`
}
