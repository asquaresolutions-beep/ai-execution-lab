# W5b — Edge Runtime Incident Correction Audit

**Date:** 2026-08-29 · **HEAD:** `763f5585d7c9f8267e63d5deadd6c4c552ec858d`
**Subject:** `content/failures/edge-runtime-deployment-failure.mdx` (844 words, 128 lines, sha `449d5bfb…`)
**Mode:** discovery only. **No implementation was performed.** No source or content file was modified, nothing staged, committed, pushed or deployed. No new mutation was applied and no preview deployment was created. Governance evaluated by calling the pure `classifyChange()` function.

---

## 1. Snapshot

```
HEAD / origin        : 763f5585d7c9f8267e63d5deadd6c4c552ec858d  (identical, sync 0/0)
staged               : 0
tracked modifications: app/api/scam-intel/quick-check/route.ts   (pre-existing, untouched)
untracked            : 127 files
lib/university dirty : 0        content/failures dirty : 0
content/labs dirty   : 0        content/lessons dirty  : 0
app/opengraph-image.tsx : 0 dirty, 0 edge exports
state/ directory     : absent          worktrees : 1
```

**University metrics:** competencies 6 · capabilities 11 · units 20 · **teachable 2** · missing principle 7 · **missing practice 18** · taught 9/11 · students 0.

**Practice relationships (2, both explicit):**

```
edge-runtime-deployment-failure  <- edge-runtime-deployment-reproduction.mdx
gemini-json-parse-failure        <- gemini-structured-output-reliability.mdx
```

---

## 2. Source claims — every statement about where the failure surfaces

Read from the complete 128-line document, not from grep hits. Five statements bear on the question:

| Line | Location | Claim | Verdict |
|---|---|---|---|
| 40 | `IncidentReport.rootCause` | *"Vercel's build succeeded locally (Node.js runtime) but failed on the edge worker."* | ✅ **consistent** |
| **55** | `FailureIntelligence.preventionPatterns[2]` | *"Run next build locally after adding any runtime export — **the error surfaces during static page generation**"* | ❌ **CONTRADICTED — finding A** |
| 96 | prose, *What Happened* | *"The build had passed locally **because `next dev` and `next build` both run in the Node.js runtime by default**. The edge runtime restriction only fires on Vercel's actual edge workers."* | ⚠ conclusion correct, **mechanism contradicted — finding C** |
| 113 | prose, *Why This Is Easy to Miss* | *"The deceptive part: `next build` passes locally. The incompatibility only surfaces when Vercel actually runs the edge worker, which doesn't happen in local builds."* | ✅ **consistent** |
| **126** | prose, *Prevention Pattern* item 4 | *"Run `next build` with `NODE_OPTIONS=--experimental-vm-modules` **to surface edge errors locally**"* | ❌ **CONTRADICTED — finding B** |

Not in scope and untouched by the evidence: the `QuickFix` block (a Vercel-side symptom and fix), the Timeline, `ecosystemImpact`, the `Callout` on the edge API surface, and all frontmatter.

---

## 3. Empirical findings

Sole evidence: the Lab A verification performed 2026-08-29 and already reported. Nothing was re-run for this audit.

1. Disposable git worktree at `52f2770`, Next.js 15.5.18, `node_modules` supplied by junction; the real working tree was never modified.
2. **Baseline** (unmutated) build in that worktree: **passed**, exit 0.
3. Mutation applied to the worktree only: `+export const runtime = 'edge'` in `app/opengraph-image.tsx` — 1 file, 2 insertions, nothing else.
4. **Check A** — `next build`: **PASSED**, exit 0.
5. **Check B** — `NODE_OPTIONS=--experimental-vm-modules next build`: **PASSED**, exit 0.
6. The mutation **demonstrably took effect**:
   - warning emitted: `⚠ Using edge runtime on a page currently disables static generation for that page`
   - `/opengraph-image` build symbol changed from `○ (Static)` to `ƒ (Dynamic)`
   - `.next/server/middleware-manifest.json` gained exactly one edge function: `/opengraph-image/route`
7. The historical error — `The Edge Runtime does not support Node.js 'crypto' module` — **did not appear** under either check.
8. **No Vercel preview deployment was created.**
9. Current Vercel behaviour therefore **remains unverified**.
10. `app/opengraph-image.tsx` in the real repository is unchanged and contains **zero** edge exports.

**What this establishes:** the two tested local build modes do not surface the historical error, and the `--experimental-vm-modules` flag does not change that.

**What this does not establish:** that the historical incident is false; that current Vercel still fails this way; how `next dev` behaves; or the current error wording. **The incident concerns Vercel edge-worker execution. A passing local build is consistent with it, not evidence against it.**

---

## 4. The exact contradictions

### Finding A — `FailureIntelligence.preventionPatterns[2]`, line 55

> *"Run next build locally after adding any runtime export — the error surfaces during static page generation"*

**Why incorrect:** `next build` was run with exactly this mutation and exited 0. The error did not surface during static page generation or anywhere else. Worse, static page generation is precisely what the edge declaration **disables** for that route — the build said so in a warning. The bullet instructs a check that cannot work and, if followed, returns a false all-clear.

**Severity: highest of the three.** It is a prevention pattern — an actionable instruction a reader is expected to rely on — and following it produces exactly the false confidence the incident elsewhere warns against.

### Finding B — prose *Prevention Pattern* item 4, line 126

> *"Run `next build` with `NODE_OPTIONS=--experimental-vm-modules` to surface edge errors locally"*

**Why incorrect:** run verbatim, exit 0, no edge error surfaced. The flag concerns ES module handling in Node's VM; it has no relationship to Next's edge-runtime compatibility checking.

**Severity: high.** Also actionable, also produces a false all-clear, and it is the *last* prevention item before the closing line — the position a reader is most likely to act on.

### Finding C — prose *What Happened*, line 96 — **newly identified by this audit**

> *"The build had passed locally **because `next dev` and `next build` both run in the Node.js runtime by default**."*

**Why the mechanism is wrong:** the local build did **not** treat the route as Node.js. It honoured the edge declaration — it warned about disabling static generation, flipped the route to dynamic, and registered `/opengraph-image/route` as an edge function in the middleware manifest. The build passed not because it ignored the declaration but because **Next did not evaluate the edge bundle's Node-API compatibility at build time**.

**Severity: moderate.** The conclusion (*the build passes locally*) is correct and is the load-bearing claim. Only the causal explanation is wrong. It matters because that explanation is the reasoning a reader carries to the next file — and "local builds run Node.js so edge declarations are inert locally" is a false model that will mislead them again.

**No other statement in the document is contradicted by the evidence.**

---

## 5. Minimal correction proposal — design only, not applied

### A — line 55

**Replace:**
```
"Run next build locally after adding any runtime export — the error surfaces during static page generation"
```
**With:**
```
"A local next build does NOT catch this — verified 2026-08-29: the build passes and only warns that static generation is disabled. Treat the warning as the signal"
```
Preserves the *check-locally* instinct while correcting what the check actually yields, and points at the one locally observable signal that does exist.

### B — line 126

**Replace:**
```
4. Run `next build` with `NODE_OPTIONS=--experimental-vm-modules` to surface edge errors locally
```
**With:**
```
4. Do not rely on a local build to catch this. Verified 2026-08-29: both `next build` and
   `next build` with `NODE_OPTIONS=--experimental-vm-modules` pass with the edge export in
   place. The only local signal is the warning that static generation has been disabled for
   that route — and a route silently becoming an edge function in the build manifest.
```
Converts a false instruction into a true negative result plus the real signal. **Retains the flag by name** so a reader who remembers the old advice finds it explicitly retired rather than silently deleted.

### C — line 96

**Replace:**
```
The build had passed locally because `next dev` and `next build` both run in the Node.js
runtime by default. The edge runtime restriction only fires on Vercel's actual edge workers.
```
**With:**
```
The build had passed locally. Re-tested 2026-08-29 on Next.js 15.5.18: `next build` accepts
the edge export, warns that static generation is disabled for the route, and registers it as
an edge function — then exits 0. The Node-API incompatibility is not evaluated at build time;
the restriction fires when Vercel actually runs the edge worker.
```
Keeps the correct conclusion, replaces the false mechanism with the observed one, and **drops the unverified `next dev` claim** rather than restating it — `next dev` was never tested.

### Surrounding sections

- **Line 113** (*Why This Is Easy to Miss*) — **leave unchanged.** It is correct and is now the document's most accurate sentence.
- **Line 40** (`IncidentReport.rootCause`) — **leave unchanged.** *"succeeded locally … failed on the edge worker"* is consistent; its parenthetical "(Node.js runtime)" is the same imprecision as C, but it is a compressed historical summary rather than an instruction. Correcting it is optional; leaving it is defensible.
- **`QuickFix`, Timeline, `Callout`, `ecosystemImpact`, all frontmatter** — **do not touch.** No evidence bears on them.

### Facts the correction must preserve

All five hold in the proposed wording:

- ✅ the historical production failure occurred (Timeline, `IncidentReport`, `ExecutionEvidence` untouched)
- ✅ local build success did not establish production safety — now stated explicitly rather than implied
- ✅ current Vercel behaviour has not been re-tested — the replacements say *verified locally on 2026-08-29*, never *verified on Vercel*
- ✅ the empirical test did not reproduce the historical error locally — stated as a negative result
- ✅ students must not treat local success as proof of deployment safety — reinforced in both A and B

**Scope: three edits in one file.** No unrelated prose rewritten.

---

## 6. Governance

```json
{"class":"patch","why":"correction with no change in what is assessed",
 "requires":["curriculum_owner_approval"],"notice":false}
```

**Class `patch`, as expected.** Matches `governance.json`'s patch trigger *"a unit's source document is corrected."* A `patch` would nominally bump `1.0.0 → 1.0.1`.

**Do not apply that bump.** Per instruction, `governance.json` is not to be modified, no version change, no approval entry. Recorded here only so the classification is on the record.

Nothing in the proposal adds a unit, capability, graph edge, rubric criterion, certification requirement or graduation rule.

---

## 7. Regression and integrity assessment

**A prose correction cannot move any engine metric.** Verified by reading the engine:

| Engine function | Reads | Affected by prose? |
|---|---|---|
| `findPractice()` | `lab.fm.reproduces` slugs only | **No** |
| `findPrinciple()` | `incident.fm.related_docs` slugs only | **No** |
| `classify()` | tags · `failure_type` · systems · **title** keywords | **No** — body prose is never read |
| `buildUnits()` | frontmatter + the two matchers above | **No** |

Provided frontmatter and the document **title** are untouched — and the proposal touches neither — classification, beats and every derived count are unchanged.

**No changes required to:** Lab A · `lib/tracks.ts` · `lib/university/**` · `content/labs/**` · `content/lessons/**` · `app/opengraph-image.tsx`.

**Lab A remains correct after the correction — and this is the important direction of dependency.** Lab A already tells the reader the local build passes and that neither documented local check catches it. Correcting the incident makes the two documents *agree*; today they disagree, and the lab is the one that is right. Lab A's `reproduces: [edge-runtime-deployment-failure]` is unaffected; **Practice remains exactly 2.**

**Post-correction expected state — unchanged in every respect:**

```
competencies 6 · capabilities 11 · units 20 · teachable 2
missing principle 7 · missing practice 18 · taught 9/11 · mapped 12 · unknown 0 · students 0
Practice: gemini-json-parse-failure, edge-runtime-deployment-failure
route count unchanged · no new tag routes (no tag change proposed)
```

Gates that would still need to run at implementation: `tsc --noEmit` · scam-intel · the six read-only University commands · `next build` (the incident is a rendered page at `/failures/edge-runtime-deployment-failure`, so its output changes and should be verified).

---

## 8. No implementation was performed

**Explicit statement, as required.**

This audit created exactly one file — this report. It modified no source file, no content file, no University data, no engine module and no configuration. Nothing was staged, committed, pushed or deployed. No mutation was applied to any working tree. No preview deployment was created. No mutating University command was run.

`content/failures/edge-runtime-deployment-failure.mdx` is **unchanged**, sha `449d5bfbf3ea1edb825b0b2052b459ea`.

---

## Recommendation

Approve the three edits in §5 as a single `patch`-class commit against one file. Findings A and B are false actionable instructions that hand a reader a false all-clear on a high-severity deployment failure; finding C is a false mechanism that would mislead them again on the next file.

The Lab now holds evidence that two of its own prevention patterns do not work. Publishing the correction is the same discipline the [Post-Mortem Process](/tracks/claude-code-operator/debugging-recovery/post-mortem-process) lesson grades and the [structured output](/tracks/claude-code-operator/model-integration/output-contract-measurement) lesson teaches: when a measurement contradicts a document, the document changes.
