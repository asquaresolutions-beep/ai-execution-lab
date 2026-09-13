// eval/hooks.mjs
//
// Resolver hook for the Tier-2 evaluation harness.
//
// Teaches plain Node the two things tsconfig.json already knows but Node ESM does
// not: (1) extensionless relative imports, (2) the "@/" path alias. This is what
// lets the harness import the REAL production modules instead of copies.
//
// Zero production change. Zero dependencies. Uses Node's built-in registerHooks.
//
// Usage: node --import ./eval/hooks.mjs eval/run-eval.mjs

import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function tryCandidates(base) {
  for (const c of [base + '.ts', base + '.tsx', path.join(base, 'index.ts'), base]) {
    if (existsSync(c) && path.extname(c)) return c
  }
  return null
}

// Next ships `next/server` as a bare specifier that its own bundler resolves, but
// plain Node ESM cannot — it needs the explicit `next/server.js`. Mapping it here
// lets the harness import real API route handlers (which import NextResponse) and
// exercise them end-to-end, rather than re-implementing route logic in a test.
const BARE_ALIASES = {
  'next/server': 'next/server.js',
  'next/navigation': 'next/navigation.js',
  'next/headers': 'next/headers.js',
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (BARE_ALIASES[specifier]) {
      const mapped = path.join(ROOT, 'node_modules', BARE_ALIASES[specifier])
      if (existsSync(mapped)) return { url: pathToFileURL(mapped).href, shortCircuit: true }
    }
    if (specifier.startsWith('@/')) {
      const hit = tryCandidates(path.join(ROOT, specifier.slice(2)))
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true }
    }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const parent = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : ROOT
      const abs = path.resolve(parent, specifier)
      if (!path.extname(abs)) {
        const hit = tryCandidates(abs)
        if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true }
      }
    }
    return nextResolve(specifier, context)
  },
})
