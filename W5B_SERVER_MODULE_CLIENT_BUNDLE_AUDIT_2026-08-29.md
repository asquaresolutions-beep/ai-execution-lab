# W5b Lab B — `server-module-client-bundle` Reproduction Audit

**Date:** 2026-08-29 · **HEAD:** `e1de0bf653ac815c48c52e361b3200a2b64a32b6`
**Target incident:** `content/failures/server-module-client-bundle.mdx`
**Mode:** Phase 1 discovery only. No file modified, no worktree created, no mutation applied, nothing staged, committed, pushed or deployed. Governance evaluated by calling the pure `classifyChange()` function.

---

## 1. Snapshot

```
HEAD / origin        : e1de0bf653ac815c48c52e361b3200a2b64a32b6  (identical, sync 0/0)
staged               : 0
tracked modifications: app/api/scam-intel/quick-check/route.ts   (pre-existing, carried forward)
untracked            : 128 files (audit reports + unrelated carried-forward work)
lib/university dirty : 0     content/failures dirty : 0
content/labs dirty   : 0     content/lessons dirty  : 0
lib/tracks.ts dirty  : 0     state/ : absent     worktrees : 1
page count           : 1032 (last build)
```

**University:** competencies 6 · capabilities 11 · units 20 · **teachable 2** · missing principle 7 · **missing practice 18** · taught 9/11 · students 0.

**Practice relationships (2, both explicit):** `edge-runtime-deployment-failure` ← `edge-runtime-deployment-reproduction.mdx` · `gemini-json-parse-failure` ← `gemini-structured-output-reliability.mdx`.

The working tree is clean apart from the known carried-forward `route.ts` modification and untracked reports.

---

## 2. Incident mechanism

Read in full (94 lines of body plus frontmatter and four MDX components).

| Field | Value |
|---|---|
| Severity / type | **high** / `build` |
| Resolution time | 18 minutes · recovery complexity: minutes |
| `time_to_detect` | *"Immediate — next build fails with Module not found"* |
| Repeat risk | medium |

**Triggering mutation.** `getLessonContent()` was added to `lib/tracks.ts`; it reads MDX from disk, so the file gained `import fs from 'fs'` and `import path from 'path'` at top level.

**Import chain (as recorded).** `lib/tracks.ts` was already imported by `components/tracks/track-roadmap.tsx`, which carries `'use client'`. Next.js follows every import of a client component into the browser bundle, and the browser has no Node built-ins.

**Exact failure surface, quoted:**

```
Module not found: Can't resolve 'fs'
Import trace for requested module:
  ./lib/tracks.ts
  ./components/tracks/track-roadmap.tsx
```

**The rule the incident states.** *"The boundary is transitive — if `track-roadmap.tsx` imports `lib/tracks.ts`, then everything `lib/tracks.ts` imports must also be browser-safe."*

**Recovery.** Move `getLessonContent()` to a new server-only file `lib/lesson-content.ts`; remove `fs`/`path` from `lib/tracks.ts`; have the Server Component page import from the new location.

**Claims about build vs runtime.** Consistent throughout: `time_to_detect` says build; `QuickFix.symptom` says *"next build fails"*; §*Why This Is Hard to Catch Before Build* says *"Local `next dev` sometimes tolerates this error… The failure surfaces during `next build` when Next.js constructs the full client bundle."*

**Claims about local reproduction.** `FailureIntelligence.preventionPatterns[2]`: *"Run next build locally after adding any new imports to lib/ files — catches this before it reaches Vercel."*

**Prevention guidance.** Four items, including the `.server.ts` naming convention and *"Use Next.js server-only package (`import server-only`)"*.

---

## 3. Source-anchor map — verified against current code

| Anchor | State today |
|---|---|
| `lib/tracks.ts` | **PRESENT**, 859 lines, **zero imports** — a pure data module. `fs`/`path` count: **0**. No `'use client'`. The fix held. |
| `lib/lesson-content.ts` | **PRESENT**, 18 lines, `import fs from 'fs'` + `import path from 'path'` at lines 5–6. Imported by exactly one file: the Server Component lesson page. |
| **`components/tracks/track-roadmap.tsx`** | **PRESENT** — the very component the incident names. Line 1 `'use client'`. |
| `components/tracks/lesson-sidebar.tsx` | **PRESENT**, `'use client'`, also imports `@/lib/tracks`. |
| `next.config.mjs` | **No `webpack` block, no `resolve.fallback`, no polyfill, no `serverExternalPackages`.** Nothing configured that could shim or mask a client-side `fs` resolution failure. |
| Versions | next `15.5.18` installed (`^15.3.2` declared) · react 19 · TypeScript 5.7 |

**Every file importing `@/lib/tracks`, with boundary status:**

```
app/sitemap.ts                                    server
app/tracks/[track]/[module]/[lesson]/page.tsx     server
app/tracks/[track]/page.tsx                       server
app/tracks/page.tsx                               server
components/tracks/lesson-nav.tsx                  server/shared
components/tracks/track-card.tsx                  server/shared
components/tracks/lesson-sidebar.tsx              'use client'  ← CLIENT
components/tracks/track-roadmap.tsx               'use client'  ← CLIENT
```

**Critical detail — the imports are value imports, not type-only.** Both client components do:

```tsx
import type { Track, Module, Lesson } from '@/lib/tracks'   // erased at compile time
import { TRACK_ACCENTS } from '@/lib/tracks'                // ← REAL VALUE IMPORT
```

A type-only import would be erased by the TypeScript transform and would **not** pull the module into the client bundle. `TRACK_ACCENTS` is a runtime value, so `lib/tracks.ts` genuinely enters the browser bundle through **two** client components.

---

## 4. Current dependency chain

```
server-module-client-bundle
        ↓
mutation:  add `import fs from 'fs'` to lib/tracks.ts
        ↓
lib/tracks.ts            (859 lines, currently zero imports)
        ↓  value import of TRACK_ACCENTS
components/tracks/track-roadmap.tsx   'use client'   ← the component the incident names
components/tracks/lesson-sidebar.tsx  'use client'   ← a second, independent path
        ↓
Next.js client-bundle construction (no fallback/polyfill configured)
        ↓
expected: Module not found: Can't resolve 'fs'
          + import trace naming lib/tracks.ts and the client component
```

**The historical chain is intact, and it is now doubled** — the incident recorded one client importer; there are two today.

---

## 5. Reproduction feasibility

| Question | Answer |
|---|---|
| Is `lib/tracks.ts` unchanged / clean? | Yes — 0 dirty, 0 imports |
| Is `fs` imported anywhere in the client path today? | **No** |
| Does the consumer chain still exist? | **Yes**, via two `'use client'` components |
| Does a disposable worktree have everything needed? | Yes — all anchors are tracked files; `node_modules` reusable by junction, as proven in Lab A |
| Can `node_modules` be reused without copying? | **Yes** — directory junction, and it must be removed with `Directory.Delete(path, false)` so deletion never recurses into the real tree |
| Is a `.env` needed? | **No** — Lab A's baseline build succeeded in a worktree with no `.env` present |

**Baseline command:** `NODE_OPTIONS=--max-old-space-size=4096 node node_modules/next/dist/bin/next build` in the worktree, unmutated. Must exit 0.

**Mutated command:** the identical command after adding one line to `lib/tracks.ts`.

**What would count as reproduction:** a **non-zero exit** with `Module not found: Can't resolve 'fs'` and an import trace naming `./lib/tracks.ts` and a client component. Anything else — including a passing build — is a finding to record, not to paper over.

---

## 6. Safety classification

| Requirement | Needed? |
|---|---|
| External services | **No** |
| Credentials / API keys | **No** |
| Production access | **No** |
| Deployment | **No** |
| Database writes | **No** |
| Payment credentials | **No** |
| Network access | **No** (build is local; `node_modules` already installed) |
| Destructive operations | **No** — one added line, discarded with the worktree |
| Modification outside a disposable worktree | **No** |

**The mutation can be tested entirely locally in a disposable git worktree.** It is strictly safer than Lab A's, because the expected failure is a build-time module-resolution error rather than something that may only exist on Vercel.

---

## 7. Proposed disposable-worktree experiment — Phase 2, not performed

**A. Clean baseline**
```bash
git worktree add --detach D:/ClaudeCode/_w5bB-repro-worktree HEAD
# junction node_modules -> main tree (PowerShell New-Item -ItemType Junction)
cd worktree && NODE_OPTIONS=--max-old-space-size=4096 node node_modules/next/dist/bin/next build   # expect exit 0
```

**B. Exactly one mutation** — in the worktree only:
```diff
+ import fs from 'fs'
```
at the top of `lib/tracks.ts`. Nothing else. No dependency change, no config change, no second file.

**C. Command** — the identical build command.

**D. Expected observable result** — non-zero exit, `Module not found: Can't resolve 'fs'`, import trace naming `./lib/tracks.ts` and `./components/tracks/track-roadmap.tsx` (and/or `lesson-sidebar.tsx`). **To be recorded as observed, never as assumed.**

**E. Recovery** — remove the junction with `Directory.Delete(path, false)`, verify the main `node_modules` entry count is unchanged, then `git worktree remove --force` and `git worktree prune`.

**F. Proof the main tree is untouched** — `sha256sum lib/tracks.ts` before and after, `grep -c "from 'fs'" lib/tracks.ts` = 0, `git status` delta empty, `git worktree list` back to 1.

---

## 8. Contradiction analysis

**No internal contradiction found.** Every statement about where the failure surfaces agrees: `time_to_detect` (build), `QuickFix.symptom` (build), *Why This Is Hard to Catch Before Build* (build), and `preventionPatterns[2]` (local build catches it). This is materially unlike `edge-runtime-deployment-failure`, whose prose and prevention list disagreed.

**But the central claim is unverified.** `preventionPatterns[2]` — *"Run next build locally… catches this before it reaches Vercel"* — is exactly the shape of claim that proved false in the edge-runtime incident. It is plausible here (module resolution is a build-time concern and no fallback is configured) but **plausible is not verified**.

**Two minor observations, neither a contradiction:**

- The recorded import trace names only `track-roadmap.tsx`. There are **two** client importers today, so the current trace may name a different or additional component. That is drift, not error.
- Prevention pattern 4 recommends the `server-only` package; `lib/lesson-content.ts` does not use it, and `.server.ts` naming (pattern 1) was not adopted either — the file is `lesson-content.ts`. These are unfollowed recommendations, not false claims. **Out of scope.**

**Consequence for Phase 2:** the empirical test must run **before** the lab is written, and the lab must state the observed result. If the build passes, Lab B must say so — exactly as Lab A does — and this audit's verdict would need revisiting.

---

## 9. Existing-lab overlap

| Lab | `reproduces` | Overlaps Lab B's subject? |
|---|---|---|
| `gemini-structured-output-reliability` | `gemini-json-parse-failure` | No |
| `edge-runtime-deployment-reproduction` | `edge-runtime-deployment-failure` | **No** — sibling failure, different mechanism: runtime *declaration* vs *import boundary* |
| `litespeed-ucss-scoped-css-stripping` | — | No |
| `wordpress-ecosystem-rollout-evidence` | — | No |
| `quickfix-semantic-html-ai-extraction` | — | No |
| `2026-05-18-geo-entity-density-experiment` | — | No |

Labs claiming `server-module-client-bundle`: **0**. Labs mentioning client-bundle / module-boundary / "Module not found": **0**.

**No existing lab should receive `reproduces`. No existing lab is repurposed.** Lab B would be a new file with `reproduces: [server-module-client-bundle]`.

Note the two incidents are `linked_incidents` of each other and Lab A cites this one — but they teach different mechanisms and must not share a lab.

---

## 10. Tag-collision analysis

**Tags are not, and must not become, a Practice signal.** Reported for awareness only; W5a's explicit `reproduces` contract stays the sole resolver and **no fallback matcher may be introduced.**

Target incident tags: `["next.js", "client-bundle", "fs", "module-boundary"]`

Current old-style overlap of this incident with existing labs: `edge-runtime-deployment-reproduction` **1** (`next.js`), `quickfix-semantic-html-ai-extraction` **1** (`next.js`), all others **0**. **Nothing reaches the old ≥2 threshold today.**

Corpus-wide, 9 pairs would reach overlap ≥2 under the retired matcher: 2 declared, **7 collisions** — all correctly rejected since W5a.

**Guidance for Phase 2:** `client-bundle`, `fs` and `module-boundary` are highly specific and appear on no lab. `next.js` is common. A Lab B tagged `["next.js", "client-bundle", "module-boundary"]` would reach ≥2 overlap with **only** its own target incident. It would create **no** new collisions — but that is a hygiene note, not a mechanism. Also check whether any chosen tag is single-use, since a new tag creates a `/tags/*` route (the +2-route surprise from Lab A).

---

## 11. Practice relationship proposal

```yaml
# content/labs/<lab-b>.mdx
reproduces:
  - server-module-client-bundle
```

One incident, declared on the new lab only. No existing `reproduces` altered. No engine change. No fallback.

**Expected effect if the experiment succeeds:** teachable **2 → 3** · missing practice **18 → 17** · `server-module-client-bundle` 2/4 → **3/4** (the ceiling; Proof stays hardcoded absent). Unchanged: units 20 · competencies 6 · capabilities 11 · missing principle 7 · taught 9/11 · mapped 12 · unknown 0 · students 0.

**If the experiment fails to reproduce**, the correct outcome is either a lab that honestly records a passing build (as Lab A does) or no lab at all — **not** a `reproduces` claim the evidence does not support.

---

## 12. Governance

```json
{"class":"none","why":"no governed change detected","requires":[],"notice":false}
```

**Class `none`.** Adding a lab and its `reproduces` declaration adds no unit (the 20 incidents already exist), no capability, no graph edge, no rubric criterion, no certification requirement, no graduation rule. `governance.json` and `curriculum_version` are not to be modified.

---

## 13. Verdict

## **SAFE TO IMPLEMENT**

Based on evidence, not on the Phase 1 ranking:

- **Exact incident:** `server-module-client-bundle`
- **Exact mutation:** add `import fs from 'fs'` to `lib/tracks.ts` — one line, in a disposable worktree only
- **Exact anchor:** `lib/tracks.ts` (859 lines, currently **zero** imports) consumed by **two** `'use client'` components via a **value** import of `TRACK_ACCENTS` — including `track-roadmap.tsx`, the component the incident names by name
- **Exact expected failure:** `Module not found: Can't resolve 'fs'` with an import trace, at build time
- **Exact recovery:** discard the worktree; the mutation never touches the main tree
- **Is a local build sufficient?** **Expected yes** — no fallback or polyfill is configured, and module resolution is a build-time concern. **This must be proven in Phase 2 before the lab claims it.**
- **Contradictions remaining:** **none internal.** One unverified claim (`preventionPatterns[2]`), which the Phase 2 experiment will settle either way.

**This is a stronger candidate than Lab A.** Lab A's failure lives on Vercel and could not be reproduced locally; this one is expected to fail loudly in a local build, and the named anchor is still present.

**One binding condition:** Phase 2 must run the experiment **before** writing the lab, and the lab's claims must follow the observed result. That sequencing is what caught the edge-runtime document's two false prevention patterns.

---

## 14. Exact Phase 2 scope if approved

**Files Phase 2 would be allowed to modify — exactly one:**

```
content/labs/<new-lab-filename>.mdx      (new file, the only creation)
```

**Plus a disposable git worktree** outside the repository, created and destroyed within Phase 2, in which `lib/tracks.ts` is mutated **temporarily and never committed**.

**Explicitly NOT modifiable in Phase 2:** `lib/tracks.ts` (main tree) · `lib/lesson-content.ts` · any `'use client'` component · `content/failures/**` (including this incident, even if the test contradicts it — that would be a separate patch) · `content/lessons/**` · existing labs · `lib/university/**` · `lib/tracks.ts` registration (labs need none — confirmed: 0 lab references in `tracks.ts`) · `next.config.mjs` · `governance.json` · `curriculum_version`.

**Phase 2 sequence:** worktree → baseline build → one-line mutation → build → record verbatim → junction removed non-recursively → worktree removed → main-tree integrity proven → **then** write the lab to match the result → gates → report → stop for commit approval.

---

**No implementation was performed.** This audit created exactly one file — this report.
