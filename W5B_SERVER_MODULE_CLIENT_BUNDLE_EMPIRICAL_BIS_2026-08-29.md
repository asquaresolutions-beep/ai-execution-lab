# W5b Lab B — Empirical Reproduction, Corrected Mutation (bis)

**Date:** 2026-08-29 · **HEAD:** `e1de0bf653ac815c48c52e361b3200a2b64a32b6`
**Phase:** 2A-bis — empirical test only. **No lab was created.** No commit, no push, no deploy, no incident correction. The main working tree was never modified.

---

## Verdict, first

## **HISTORICAL REPRODUCTION CONFIRMED**

`next build` failed with **exit 1** and the exact historical error, naming the exact historical component:

```
Failed to compile.

./lib/tracks.ts
Module not found: Can't resolve 'fs'

https://nextjs.org/docs/messages/module-not-found

Import trace for requested module:
./components/tracks/track-roadmap.tsx


> Build failed because of webpack errors
```

Compilation terminated before static page generation. The mechanism is the client/server module boundary the incident describes.

---

## 1. Main-tree snapshot

```
HEAD / origin        : e1de0bf653ac815c48c52e361b3200a2b64a32b6  (identical, sync 0/0)
staged               : 0
tracked modifications: app/api/scam-intel/quick-check/route.ts  (pre-existing)
state/               : absent      worktrees : 1      node_modules : 454 entries
University           : units 20 · teachable 2 · missing practice 18 · taught 9/11
Practice count       : 2
lib/tracks.ts        : 859 lines, 0 imports
```

| Anchor | sha256 (first 32) |
|---|---|
| `lib/tracks.ts` | `e6f51f20585203360d4425eb4e1e0732` |
| `lib/lesson-content.ts` | `5a69bfa247f906f28ccf9fcb914df95c` |
| `components/tracks/track-roadmap.tsx` | `91e4e3c429b9cb38da1239a1ff401f4c` |
| `components/tracks/lesson-sidebar.tsx` | `38160efc07ba9f92b50e5edba2499052` |
| `next.config.mjs` | `a14436710b11c86fc57754a0eb5d41a8` |

**Disposable worktree:** `D:/ClaudeCode/_w5bBbis-repro`, fresh, detached at `e1de0bf…`, 0 dirty, all five anchors verified byte-identical, `node_modules` supplied by junction (reparse point confirmed, next 15.5.18 resolvable, main count unchanged at 454).

---

## 2. Baseline — before mutation

```
lib/tracks.ts imports : 0        worktree dirty : 0
NODE_OPTIONS=--max-old-space-size=4096 next build
✓ Compiled successfully in 34.9s
✓ Generating static pages (1032/1032)
BASELINE_EXIT = 0
```

Baseline passed at **1032/1032 pages**. Environment valid.

---

## 3. The exact corrected mutation

```diff
+import fs from 'fs'
+const _reproFs = fs.readFileSync
```

Two lines, prepended to `lib/tracks.ts`. `numstat: +2 −0`.

**What was deliberately not done:** no `path` import · no `getLessonContent()` recreation · no file I/O executed during the build (`fs.readFileSync` is *referenced*, never *called*) · no existing export's semantics changed · no client component touched · no `next.config` change · no install · no network · no deployment.

**Verified at the moment of the build:** worktree dirty entries **1**, files changed other than `lib/tracks.ts` **0**, main-tree `lib/tracks.ts` sha still `e6f51f20…`, main-tree imports **0**.

---

## 4. Why the previous bare import was compiler-elided

Phase 2A added only `import fs from 'fs'`, with no reference to `fs` anywhere in the file body. Measured then:

| Signal | Value |
|---|---|
| Occurrences of `fs.` in the file body | **0** |
| Client chunks referencing `fs` | **0** |
| `fs` refs in `build-manifest.json` | **0** |
| `verbatimModuleSyntax` | **unset** |
| `noUnusedLocals` | unset (so no type error either) |

With `verbatimModuleSyntax` unset and the default import never referenced, the TypeScript/SWC transform **removes the import statement during compilation**. Webpack never receives a request for `fs`, so it never attempts to resolve it for the browser. The build passed — not because the boundary was absent, but because the mutation was deleted before reaching the boundary.

`const _reproFs = fs.readFileSync` creates a genuine value reference. The import can no longer be elided, survives into the emitted module, and webpack must resolve `fs` in the client graph — where it does not exist.

**This is the entire difference between the two experiments: one line that makes the import real.**

---

## 5. Mutated build result

```
MUTATED_EXIT = 1
```

Full output, 15 lines, verbatim — nothing suppressed:

```
   ▲ Next.js 15.5.18

   Creating an optimized production build ...
Failed to compile.

./lib/tracks.ts
Module not found: Can't resolve 'fs'

https://nextjs.org/docs/messages/module-not-found

Import trace for requested module:
./components/tracks/track-roadmap.tsx


> Build failed because of webpack errors
```

---

## 6. Exact error and import trace

| Question | Observed |
|---|---|
| Exit code | **1** |
| `Can't resolve 'fs'` appears | **YES** (1 occurrence) |
| Import trace appears | **YES** |
| `./lib/tracks.ts` named | **YES** |
| **`track-roadmap.tsx` named** | **YES** |
| **`lesson-sidebar.tsx` named** | **NO — 0 occurrences** |
| Failure during compilation | **YES** — *"Failed to compile"*, *"Build failed because of webpack errors"* |
| Static page generation reached | **NO** — 0 occurrences; the build terminated first |
| Client/server boundary implicated | **YES** — the trace names a `'use client'` component |

**Precision on the trace, as required.** Next reports **exactly one** client component: `./components/tracks/track-roadmap.tsx`. `lesson-sidebar.tsx` — the second `'use client'` value-importer of `@/lib/tracks` identified in Phase 1 — **does not appear**. Webpack reports the first failing import path it encounters, not the exhaustive set. **A lab must not claim both components appear; only one does.**

`track-roadmap.tsx` is the component the incident names by name. The historical trace listed `./lib/tracks.ts` and `./components/tracks/track-roadmap.tsx` on separate lines; the current format puts `./lib/tracks.ts` as the error header and the client component under the trace. **Substantively identical, cosmetically different.**

---

## 7. Mechanism verification

```
lib/tracks.ts
  → import fs from 'fs'  +  const _reproFs = fs.readFileSync   (reference survives compilation)
  → value import of TRACK_ACCENTS by components/tracks/track-roadmap.tsx  ('use client')
  → module enters the client bundle graph
  → webpack must resolve Node built-in 'fs' for the browser
  → Module not found: Can't resolve 'fs'
  → build fails at compile time, before page generation
```

Every step is evidenced by the build output itself. The error names the file that gained the import; the trace names the client component that pulls it; the failure is a browser-target resolution failure for a Node built-in.

Corroborating evidence from Phase 2A, unchanged and still relevant: `shadow-amber-500/10` — a string unique to `TRACK_ACCENTS` — appears in a **client chunk**, proving `lib/tracks.ts` genuinely crosses the boundary. Webpack tree-shakes the module across that boundary (the large `TRACKS` array does **not** reach the client), but `TRACK_ACCENTS` does, which is sufficient to drag the whole module's imports into client resolution.

---

## 8. Safety classification

| Requirement | Needed? |
|---|---|
| External services · credentials · deployment · production access | **No** |
| Database writes · payment credentials · network calls | **No** |
| Destructive operations | **No** — two lines, discarded with the worktree |
| Executed file I/O during build | **No** — `fs.readFileSync` is referenced, never invoked |
| Modification outside the disposable worktree | **No** |

**Deterministic:** yes — same commit, same mutation, same failure, and the error is a static resolution failure with no timing or environmental component.

**Smaller than the historical implementation:** yes — two lines versus a full `getLessonContent()` function with `fs`, `path`, a `LESSONS_ROOT` constant and a multi-branch body.

---

## 9. Recovery

```
git checkout -- lib/tracks.ts
worktree dirty : 0     imports : 0     _reproFs refs : 0
worktree sha   : e6f51f20585203360d4425eb4e1e0732   ( == HEAD e1de0bf, == main )
```

Junction removed **non-recursively** via `[System.IO.Directory]::Delete(path, $false)`, only after confirming the reparse-point attribute — never `Remove-Item -Recurse`. Main `node_modules`: **454 before, 454 after — INTACT.**

Worktree removed with `git worktree remove --force`, then `git worktree prune`. Directory gone. `git worktree list` back to **1**.

---

## 10. Main-tree integrity

| Check | Result |
|---|---|
| All 5 anchor hashes | **byte-identical to snapshot** |
| `lib/university` (15) · `content/failures` (20) · `content/labs` (6) · `content/lessons` (57) | **byte-identical** |
| `lib/tracks.ts` `fs` imports in main tree | **0** |
| `lib/tracks.ts` total imports | **0** |
| `node_modules` | 454 entries |
| `state/` | absent |
| staged | 0 |
| HEAD / origin | `e1de0bf…` / `e1de0bf…`, sync 0/0 |
| tracked modifications | `route.ts` only, unchanged |
| worktrees | **1** |
| **`git status` delta vs snapshot** | **empty — nothing changed** |
| University | units 20 · teachable 2 · missing practice 18 |

**The mutation exists nowhere in the main tree.**

---

## 11. Final verdict

## **HISTORICAL REPRODUCTION CONFIRMED**

The incident `server-module-client-bundle` is faithfully reproducible in a disposable worktree with a **two-line** mutation, producing the recorded error and naming the recorded component, at build time, with no external dependency of any kind.

Two things this establishes beyond the bare confirmation:

1. **The incident's `preventionPatterns[2]` is now supported by evidence.** *"Run next build locally after adding any new imports to lib/ files — catches this before it reaches Vercel."* It does. This is the opposite of what the edge-runtime incident's equivalent claim turned out to be. **No incident correction is warranted, and none was made.**
2. **"Add a Node import and the build fails" is incomplete.** A bare import is elided and nothing happens. The accurate rule is *a Node import that survives compilation into a module the client bundle actually pulls*. Phase 2A and 2A-bis together demonstrate both halves — and that pair is more instructive than either alone.

---

## 12. Is Lab B content writing now justified?

**Yes.** The reproduction is confirmed, deterministic, minimal, locally executable, credential-free, and produces a loud unambiguous failure that terminates the build.

A future Lab B should be written to reflect what was actually measured:

- the mutation is **two lines**, and the second line is the one that matters
- the failure names **`track-roadmap.tsx` only**, not both client components
- the build **fails to compile** and never reaches page generation
- the bare-import result from Phase 2A is worth teaching alongside it: *the compiler can delete your mistake before the bundler sees it*, which is why a green build after adding an import proves nothing on its own
- recovery is removing the two lines; the boundary fix in production was a file split, which the incident already documents and the lab need not repeat

**Content writing remains unapproved and was not begun.** This phase produced exactly one artefact: this report.

---

## 13. What was not done

No lab created. No existing lab modified. No `reproduces` added. `lib/tracks.ts` in the main tree untouched. `content/failures/server-module-client-bundle.mdx` **not modified**. No University data or engine change. No commit, no push, no deploy. No second mutation beyond the single approved corrected form. No `path` import, no `getLessonContent()` recreation, no config change, no component change.
