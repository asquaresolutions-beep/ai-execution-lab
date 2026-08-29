# W5b Lab B — `server-module-client-bundle` Empirical Reproduction

**Date:** 2026-08-29 · **HEAD:** `e1de0bf653ac815c48c52e361b3200a2b64a32b6`
**Phase:** 2A — empirical test only. **No lab was created.** No commit, no push, no deploy. The main working tree was never modified.

---

## Verdict, first

## **B. HISTORICAL REPRODUCTION NOT CONFIRMED**

`next build` **passed, exit 0**, with `import fs from 'fs'` present at the top of `lib/tracks.ts`. The historical `Module not found: Can't resolve 'fs'` error did not occur.

**This does not contradict the incident.** The diagnosis is that the mutation as specified is **not equivalent to the historical mutation**. The historical change *used* `fs` (`fs.readFileSync` inside `getLessonContent()`); a bare unused import is elided by the TypeScript transform before webpack ever resolves it. The client/server boundary the incident describes is **still live and was verified independently** — see §9.

Per the hard-stop condition *"result differs materially from the historical incident"*, the experiment was stopped, no second mutation was attempted, and no lab was written.

---

## 1. Main-tree snapshot (baseline)

```
HEAD / origin        : e1de0bf653ac815c48c52e361b3200a2b64a32b6  (identical, sync 0/0)
staged               : 0
tracked modifications: app/api/scam-intel/quick-check/route.ts  (pre-existing)
state/               : absent          worktrees : 1
node_modules entries : 454
University          : units 20 · teachable 2 · missing practice 18 · taught 9/11
Practice count      : 2
```

**Anchor hashes:**

| File | sha256 (first 32) |
|---|---|
| `lib/tracks.ts` | `e6f51f20585203360d4425eb4e1e0732` |
| `lib/lesson-content.ts` | `5a69bfa247f906f28ccf9fcb914df95c` |
| `components/tracks/track-roadmap.tsx` | `91e4e3c429b9cb38da1239a1ff401f4c` |
| `components/tracks/lesson-sidebar.tsx` | `38160efc07ba9f92b50e5edba2499052` |
| `next.config.mjs` | `a14436710b11c86fc57754a0eb5d41a8` |

`lib/tracks.ts` at baseline: **859 lines, 0 import statements, no `'fs'` occurrence.**

---

## 2. Disposable worktree identity

```
path        : D:/ClaudeCode/_w5bB-repro   (outside the repository)
HEAD        : e1de0bf653ac815c48c52e361b3200a2b64a32b6   — matches target exactly
clean       : 0 dirty entries
node_modules: junction → main tree (reparse point confirmed), next 15.5.18 resolvable
```

All five anchor files verified **byte-identical to main** before any mutation. The main `node_modules` entry count was recorded before the junction was created and never changed.

---

## 3. Baseline result — before mutation

```
lib/tracks.ts import lines : 0
worktree dirty             : 0
NODE_OPTIONS=--max-old-space-size=4096 next build
BASELINE_EXIT = 0
```

**Baseline passed.** The environment is valid for the test; no `.env` was required.

---

## 4. The exact mutation

```diff
+import fs from 'fs'
```

Prepended to `lib/tracks.ts`. **Nothing else.** No `path`. No component change. No `next.config` change. No dependency install. No version change.

---

## 5. Mutation verification

```
worktree dirty entries        : 1
                                 M lib/tracks.ts
diff                          : +import fs from 'fs'
numstat                       : +1 -0
files changed other than
  lib/tracks.ts               : 0
MAIN lib/tracks.ts sha        : e6f51f20585203360d4425eb4e1e0732  (unchanged)
MAIN import lines             : 0
```

Confirmed at the moment of the build: exactly one line, in one file, in the worktree only.

---

## 6. Build result

```
NODE_OPTIONS=--max-old-space-size=4096 next build
MUTATED_EXIT = 0
```

The build **compiled successfully and generated static pages**. Output was byte-comparable to the baseline run.

---

## 7. Exact failure / error

**There was none.**

| Question | Observed |
|---|---|
| Exit code | **0** |
| `Can't resolve 'fs'` | **did not occur** |
| Import trace | **none emitted** |
| `lib/tracks.ts` named in an error | **no** |
| `track-roadmap.tsx` named | **no** |
| `lesson-sidebar.tsx` named | **no** |
| Failure at build time | **no failure at all** |
| Compilation terminated early | **no** |

---

## 8. Import trace

**None.** No error was produced, therefore no trace exists. Nothing is quoted here because there is nothing to quote — the historical error text is deliberately **not** reproduced in this section, since it was not observed.

---

## 9. Mechanism verification — read-only, no second mutation

Two questions had to be separated: *did the boundary fail to exist*, or *did the mutation fail to reach it*?

### The boundary exists and is live

`TRACK_ACCENTS` contains string literals unique to `lib/tracks.ts` that survive minification. Searching the client bundle:

| Literal | Client chunks | Server chunks |
|---|---|---|
| `shadow-amber-500/10` | **1** | — |
| `text-amber-400` | **6** | 4 |
| `ai-business-zero-budget` | **0** | — |
| `connect-gemini-api` | **0** | 1 |

**`lib/tracks.ts` genuinely crosses into the client bundle** — `shadow-amber-500/10` appears in a client chunk. Phase 1's premise holds: the `'use client'` value import of `TRACK_ACCENTS` is real.

A second, unexpected finding: **webpack tree-shakes the module across the boundary.** `TRACK_ACCENTS` reaches the client; the large `TRACKS` array does not (`ai-business-zero-budget` and `connect-gemini-api` appear in **0** client chunks, 1 server chunk). Only the used export crosses.

### The mutation never reached the bundler

| Check | Result |
|---|---|
| Client chunks referencing `fs` | **0** |
| `fs` refs in `build-manifest.json` | **0** |
| Occurrences of `fs.` in `lib/tracks.ts` body | **0** — imported, never used |
| `isolatedModules` | `true` |
| `verbatimModuleSyntax` | **unset** |
| `noUnusedLocals` | unset (so no type error either) |

**Diagnosis:** with `verbatimModuleSyntax` unset and the default import never referenced, the TypeScript/SWC transform **elides the import statement** during compilation. Webpack therefore never sees a request for `fs` and never attempts to resolve it for the browser.

**The historical mutation was different in kind.** It added `getLessonContent()`, which called `fs.readFileSync` — a *used* import. A used import survives the transform, reaches webpack, and fails to resolve in the client graph. **The bare import specified for this experiment is not the historical mutation; it is a subset of it that the compiler removes.**

---

## 10. Recovery verification

```
git checkout -- lib/tracks.ts
worktree dirty after revert : 0
lib/tracks.ts import lines  : 0
worktree sha                : e6f51f20585203360d4425eb4e1e0732  (== HEAD, == main)
```

Junction removed **non-recursively** via `[System.IO.Directory]::Delete(path, $false)` after confirming the reparse-point attribute — never `Remove-Item -Recurse`. Main `node_modules`: **454 entries before, 454 after — INTACT.**

Worktree removed with `git worktree remove --force`, then `git worktree prune`. Directory gone; `git worktree list` back to **1**.

---

## 11. Main-tree integrity

| Check | Result |
|---|---|
| All 5 anchor hashes | **byte-identical to baseline** |
| `lib/university` (15) · `content/failures` (20) · `content/labs` (6) · `content/lessons` (57) | **byte-identical** |
| `lib/tracks.ts` import lines | **0** — mutation absent from the main tree |
| `node_modules` | 454 entries |
| `state/` | absent |
| staged | 0 |
| HEAD | `e1de0bf…`, sync 0/0 |
| tracked modifications | `route.ts` only, unchanged |
| **`git status` delta vs snapshot** | **empty — nothing changed at all** |
| University | units 20 · teachable 2 · missing practice 18 |

**The mutation does not exist anywhere in the main tree.**

---

## 12. Final reproduction verdict

**B. HISTORICAL REPRODUCTION NOT CONFIRMED.**

The specified mutation does not reproduce the incident, because it is elided before it can. The incident's own account remains coherent and is **not** contradicted: it describes a *used* `fs` import, and this experiment did not test that.

---

## 13. Implications for a future Lab B

**Lab B is not dead — but the mutation specification must change, and that needs approval.**

A faithful reproduction requires an import that **survives compilation**, i.e. `fs` must be *referenced*. The minimal faithful mutation is closer to the historical one:

```ts
import fs from 'fs'
export const __repro = () => fs.existsSync('x')
```

or, more faithfully still, re-adding a small `getLessonContent`-shaped function to `lib/tracks.ts`. Either is **two lines rather than one**, and both fall outside the Phase 2A mandate, which permitted exactly one import and forbade any second mutation. **I did not test them.**

Three things this experiment establishes for whoever writes the lab:

1. **The boundary is live** — `lib/tracks.ts` demonstrably reaches the client bundle via `TRACK_ACCENTS`. The premise is sound.
2. **Tree-shaking is part of the story** — only the *used* export crosses. A lab should say so; it explains why a bare import is invisible and a used one is fatal.
3. **"Add a Node import and the build fails" is too simple to be true.** The real rule is *add a Node import that survives compilation into a module the client bundle actually pulls*. That is a sharper and more transferable lesson than the incident currently states — and it is exactly the kind of nuance a reproduction lab exists to surface.

**Recommended next step:** a Phase 2A-bis with an approved two-line mutation, run in a fresh disposable worktree under the same safety protocol. Only after that succeeds should Lab B be written.

**Not recommended:** writing Lab B now around an unconfirmed reproduction, or quietly widening the mutation without approval.

**Explicitly out of scope and not performed:** no correction to `content/failures/server-module-client-bundle.mdx`. Its `preventionPatterns[2]` claim — *"Run next build locally… catches this before it reaches Vercel"* — remains **unverified**, neither confirmed nor refuted, because the test that would settle it has not been run. It should not be corrected on this evidence.

---

## 14. No lab was created

This phase created exactly one file: **this report**.

No file under `content/labs/` was created or modified. No `reproduces` declaration was added. `lib/tracks.ts` in the main tree is untouched. No existing lab, lesson, incident, University data file or engine module was altered. Nothing was staged, committed, pushed or deployed.
