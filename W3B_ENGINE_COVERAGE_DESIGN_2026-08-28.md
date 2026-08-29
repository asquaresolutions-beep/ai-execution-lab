# W3b — Engine Consumption of `proves`: Coverage Design

**Date:** 2026-08-28 · **HEAD:** `54e93958dbe45c8fff23d21034dda1829acafc51`
**Preceding:** W3 implementation `76f72a2b700c532654879fadf8e6a849bbc44a0d` · W3 audit record `54e9395…`
**Mode:** discovery only. Nothing implemented. Read-only University commands only (`status`, `gaps`, `curriculum`, `graph`, `research`, `unit`).

---

## Executive finding

**The insertion point already exists and was built for exactly this.**

`corpus.mjs:106-120` contains `readTracksTs()`, which parses `lib/tracks.ts` **as text with regexes**, under an explicit comment:

> `Parsed rather than imported: the file is TypeScript and npm is unavailable here.`

So the engine already reads the file where `proves` now lives, already avoids importing TypeScript, and already avoids any coupling to the Next.js application. Reading `proves` is **one additional regex in a function that already runs**.

A second finding sharpens this. The W3 audit reported that `corpus().lessons` is never consumed. Verification for W3b shows it is worse than that:

```
grep -rn "tracksTs|\.lessons\b|readLessons|readTracksTs"
  lib/university/engine/*.mjs lib/university/university.mjs
  (excluding corpus.mjs)
→ no matches
```

**Both `corpus().lessons` and `corpus().tracksTs` are computed on every `corpus()` call and discarded.** `readTracksTs()` is dead code today — written, documented as "a second metadata source", and wired to nothing. W3b does not add a data path; it connects one that was already built and left unterminated.

**Governance answer, from the engine's own classifier:** `classifyChange()` at `governance.mjs:14-31` takes `{graphChanged, graduationChanged, rubricChanged, unitAdded, capabilityAdded, corrected}`. W3b sets **all six false** — it adds reporting over data that already exists, changes no governed artefact, and corrects nothing. The function returns:

```js
return { class: 'none', why: 'no governed change detected', requires: [], notice: false }
```

**W3b is governance class `none` — not patch, not minor.** No version bump, no approval log entry, no notice.

---

## 1. Current data flow

```
lib/university/data/*.json
   ├─ competencies.json ─> loadGraph()        ──> cmds.graph, cmds.status
   ├─ capabilities.json ─> loadCapabilities() ──> cmds.graph, cmds.status
   ├─ rules.json ────────> loadJson (classify, beat_sources)
   ├─ rubric.json ───────> assessment.mjs
   ├─ certification.json > assessment.mjs
   └─ governance.json ───> loadGovernance()   ──> cmds.status

content/failures ─┐
content/docs ─────┼──> corpus() ──> buildUnits() ──> curriculumSummary()
content/labs ─────┘                     │                    │
                                        └────────────────────┴──> cmds.status
                                                                  cmds.gaps
                                                                  cmds.curriculum
                                                                  cmds.unit

lib/university/state/students/*.json ──> allStudents() ──> cmds.status (count only)
```

`buildUnits()` (`curriculum.mjs:116`) is the single producer of every unit-shaped fact. `curriculumSummary()` (`curriculum.mjs:163`) reduces it to the counters printed by `status`.

## 2. Current lesson corpus flow

```
content/lessons/<track>/<module>/<lesson>.mdx
        │
        └─> readLessons()      (corpus.mjs:75-99)   ──> corpus().lessons   ──> ✗ DEAD END

lib/tracks.ts
        │
        └─> readTracksTs()     (corpus.mjs:106-120) ──> corpus().tracksTs  ──> ✗ DEAD END
```

`readTracksTs()` currently extracts two things and nothing else:

```js
const trackRe = /\{\s*id:\s*'([^']+)',\s*title:\s*'([^']*)'/g   // → tracks[]
const idRe    = /\bid:\s*'([a-z0-9-]+)'/g                        // → lessonIds[]
return { tracks, lessonIds: [...new Set(lessonIds)] }
```

Measured against the current file: `idRe` matches **189** ids (tracks + modules + lessons, undifferentiated), and there are **9** `proves:` arrays in the source that **no existing regex captures**.

## 3. Exact insertion point

**`corpus.mjs` → `readTracksTs()`.** One additional extraction, returning one additional key.

The lesson entries in `lib/tracks.ts` are one object per line, so a per-line parse is both simpler and safer than the existing whole-file global regexes:

```
for each line containing both  id: '<slug>'  and  proves: [ ... ]
    → { lessonId, capabilities: [...] }
```

Why this point and no other:

- It is **already inside the engine**, already reading this exact file.
- It requires **no TypeScript import**, no transpile, no `npm` — the constraint `corpus.mjs:103` was written to respect.
- It creates **no dependency on Next.js**, on `app/`, or on any React component.
- It is **pure**: reads a file, returns data, writes nothing.

**Rejected alternatives:**

| Alternative | Why rejected |
|---|---|
| Import `lib/tracks.ts` directly | Couples the engine to TypeScript tooling; violates the stated constraint at `corpus.mjs:103` |
| New JSON mapping file in `lib/university/data/` | Duplicates a fact that already lives in `tracks.ts`; creates two sources of truth and a drift risk; and `lib/university/data` is governed |
| Read from lesson MDX frontmatter | 24 of 54 lessons have no frontmatter; `tracks.ts` is the source of record |
| Extend `readLessons()` | Lesson files do not carry `proves`; the mapping is in `tracks.ts` |

## 4. Should `proves` affect… — answers with source references

| | Target | Verdict | Reason |
|---|---|---|---|
| **A** | **Capability coverage** | ✅ **Yes — the only correct target** | Coverage is a statement about *content*: does an instructional asset exist for this capability. That is exactly what `proves` records. |
| **B** | Practice beat | ❌ **Semantically incorrect** | `rules.json → beat_sources.practice.folder = "content/labs"`, described as *"The reproduction task. The student causes the failure deliberately, then fixes it."* A lesson is read, not reproduced. Letting a lesson satisfy Practice would mean a student who read a page had reproduced a failure. |
| **C** | `teachable` status | ❌ **Semantically incorrect** | `curriculum.mjs:158` defines `teachable: beats.incident.present && beats.practice.present`. Feeding lessons in silently redefines an existing published metric. Prohibited by the brief and wrong on its own terms. |
| **D** | Graph / unlock | ❌ **Semantically incorrect and the most dangerous** | `graph.mjs:75-79` computes `satisfied` from `student.certified` and `student.proven_capabilities`. Both are per-student. A lesson existing in the repository would unlock competencies for a student who has done nothing. |
| **E** | `gaps` | ✅ **Yes — additively only** | `gaps` already reports what the corpus lacks. A new *section* listing capabilities with no teaching asset is consistent. It must not alter the two existing sections. |
| **F** | New informational metric | ✅ **Yes** | One new counter in `status`: capabilities with a teaching asset. Informational, never gating. |

**Combination: A + E + F. Never B, C, or D.**

## 5. Beat-by-beat comparison

| Beat | Source of truth | Computation | Meaning | Should `proves` influence it? |
|---|---|---|---|---|
| **Incident** | `content/failures/*.mdx` | the failure doc itself; `present: true` always | A real production failure happened and was recorded | **No.** A lesson is not an incident. |
| **Principle** | `content/docs/*.mdx` | `findPrinciple()` `curriculum.mjs:106-113` — slug lookup against `incident.fm.related_docs`; **no content analysis** | The generalisable rule the incident reveals | **No.** `beat_sources.principle.folder` is `content/docs`. A lesson may *teach* a principle without *being* the principle document. Changing this would make `content/lessons` a second Principle source and break the one-document-per-beat model. |
| **Practice** | `content/labs/*.mdx` | `findPractice()` `curriculum.mjs:94-104` — ≥2 tag overlap | The student reproduces the failure deliberately | **No.** See §4B. |
| **Proof** | *none* | hardcoded `{ source: null, present: false, produced_by: 'project engine' }` `curriculum.mjs:139` | The student's own deployed artefact | **No.** Absolutely not. Proof is per-student and does not exist as a corpus document by design. |

**Consequence worth restating:** because Proof is hardcoded absent, `complete` is capped at **3/4** for every unit, permanently. Observed distribution: `1/4 ×5 · 2/4 ×12 · 3/4 ×3`. Any target expressed as "units at 4/4" is unreachable by construction.

**`proves` influences no beat.** It is a fifth, orthogonal axis: *is there instruction for this capability?* Beats describe a unit built from an incident; `proves` describes a capability. They intersect only through the two capabilities carrying `derived_from_incident`.

## 6. The `teachable: 5` defect — documented, not fixed

**The metric is not broken code. It is a name that does not match what it measures.**

`teachable` currently means: *this incident has a lab somewhere in `content/labs/` that shares at least two tags with it.* It is printed as *"teachable (incident + reproduction both present)"* (`university.mjs:105`), which readers take to mean the unit can be taught.

The five current matches, with their actual shared tags:

| Unit | Lab | Overlap | Shared tags | Genuine? |
|---|---|---|---|---|
| `gemini-json-parse-failure` | `gemini-structured-output-reliability` | 6 | gemini, structured-output, json, firebase-functions, scamcheck, trustseal | ✅ |
| `litespeed-client-cache-bypass-ignored` | `litespeed-ucss-scoped-css-stripping` | 2 | litespeed, wordpress | ✅ same subsystem |
| `gemini-rate-limit-429-no-ux` | `gemini-structured-output-reliability` | 3 | gemini, firebase-functions, scamcheck | ⚠ weak — the lab is about structured output, not rate limits |
| `firebase-deploy-sequence-auth-failure` | `gemini-structured-output-reliability` | 2 | **firebase-functions, trustseal** | ❌ false positive |
| `wordpress-sitemap-404` | `wordpress-ecosystem-rollout-evidence` | 2 | **wordpress, seo** | ❌ false positive |

**The exact defect.** `classify()` (`curriculum.mjs:16-91`) is carefully tuned: weighted signals (`tag: 3, failure_type: 2, system: 2, title_keyword: 1`), a `win_margin` of 2, a `secondary_floor` of 2, and it reports ambiguity rather than guessing. `findPractice()` (`curriculum.mjs:94-104`) has **none of that** — no weights, no margin, no ambiguity reporting, just `overlap >= 2`.

The tag vocabulary contains high-frequency platform and product tags — `wordpress`, `firebase-functions`, `scamcheck`, `trustseal`, `seo` — which appear across otherwise unrelated documents. A flat threshold of 2 over that vocabulary produces collisions by construction. A Firebase **deploy-sequence auth** failure is not practised by a **Gemini structured-output** lab; they share a platform and a product.

**Honest count: 2 unambiguous, 1 weak, 2 false positives.**

**Recommendation: fix this as a separate change, not inside W3b.** Candidate remedies — require overlap ≥3; weight tags by inverse document frequency; exclude a declared set of platform/product tags from the overlap; or introduce a `reproduces:` frontmatter key on labs naming their incident explicitly (mirroring how `related_docs` drives Principle). The last is the most consistent with the existing architecture and the least magical.

**Do not bundle this with W3b.** W3b adds a metric; this changes one. They must be separately reviewable.

## 7. State vocabulary — extend what exists, invent nothing

`progress.mjs:18-40` already defines a ranked ladder with an explicit `advances_competency` flag:

```js
export const SIGNALS = {
  exposure:      { owner: 'lib/progress.ts', meaning: 'lessons marked complete in the browser',   advances_competency: false },
  reproduction:  { owner: 'university',      meaning: 'a failure reproduced deliberately, with the log', advances_competency: false },
  capability:    { owner: 'university',      meaning: 'a proof task accepted',                    advances_competency: true  },
  certification: { owner: 'university',      meaning: 'a portfolio accepted for a competency',    advances_competency: true  },
}
```

The states the brief asks about map onto this ladder with **exactly one addition**:

| Proposed name | Level | Owner | Subject | `advances_competency` | Source |
|---|---|---|---|---|---|
| **`taught`** | **0 — NEW** | `lib/tracks.ts` | **content** | `false` | `Lesson.proves` |
| `exposure` | 1 | `lib/progress.ts` | student | `false` | existing |
| `reproduction` | 2 | university | student | `false` | existing |
| `capability` *(proven)* | 3 | university | student | **`true`** | existing |
| `certification` | 4 | university | student | **`true`** | existing |

**`taught` is the only new state, and it is the only one whose subject is content rather than a student.** Levels 1–4 all describe a person; level 0 describes the repository. That distinction is the invariant the brief asks to preserve, and naming it explicitly is what protects it.

Recommended field names, chosen to be unmistakable:

- `taught: boolean` — at least one lesson declares `proves` for this capability
- `teaching_assets: []` — the lessons that do
- **Avoid `covered`.** It reads as "done" and blurs content with attainment.
- **Never reuse `proven`.** `proven` belongs to `student.proven_capabilities` (`progress.mjs:47`, `graph.mjs:72`).

## 8. Proposed output

### `status` — one added line

```
curriculum version : 1.0.0  (APPROVAL PENDING)
competencies       : 6   capabilities: 11
capabilities taught: 6 of 11          ← NEW (informational; teaching is not proving)
units from corpus  : 20   teachable: 5
evidencing units   : 3
students           : 0
```

### `gaps` — one added section, existing sections untouched

```
Capabilities with NO teaching asset (5) - no lesson declares `proves` for these:
    ship-a-user-surface          building
    structured-output-contract   integrating
    detect-production-break      operating
    claim-with-dataset           evidencing     [research 0/3 teachable]
    falsifiable-claim            evidencing     [research 0/3 teachable]
```

### All 11 capabilities — projected output

| Capability | Competency | `taught` | Teaching assets |
|---|---|---|---|
| `deploy-and-read-logs` | foundations | ✅ | `vercel-for-beginners`, `deployment-pipeline`, `build-failure-diagnosis` |
| `version-control-recovery` | foundations | ✅ | `bad-commit-recovery` |
| `env-separation` | foundations | ✅ | `env-vars-secrets` |
| `ship-a-user-surface` | building | ❌ | — |
| `handle-every-api-branch` | integrating | ✅ | `connect-gemini-api` |
| `structured-output-contract` | integrating | ❌ | — |
| `detect-production-break` | operating | ❌ | — |
| `write-a-postmortem` | operating | ✅ | `post-mortem-process` |
| `claim-with-dataset` | evidencing | ❌ | — |
| `falsifiable-claim` | evidencing | ❌ | — |
| `measure-findability` | distributing | ✅ | `google-search-console-setup`, `google-analytics-data-thinking` |

**6 taught · 5 not taught.**

### The 20 units — output unchanged

`curriculum` and `unit` output must be **byte-identical** after W3b. Units are built from incidents; `proves` is a capability-level fact. The `beats` block, `complete`, `teachable`, `competency` and `classification` fields all stay exactly as they are.

The only defensible unit-level addition would be an informational cross-reference on the two capabilities carrying `derived_from_incident` (`handle-every-api-branch` → `gemini-rate-limit-429-no-ux`, `structured-output-contract` → `gemini-json-parse-failure`). **Recommend deferring it** — it earns little and risks reading as a beat.

### How student proof stays separate

Three structural guarantees, none of which W3b touches:

1. `graph.mjs:70-97` `unlocked()` reads only `student.certified` and `student.proven_capabilities`. The coverage function is never called from it.
2. `progress.mjs:81` `proveCapability()` throws without an artefact: *"a proof task requires an artefact - a claim is not proof"*.
3. `taught` lives on a capability record derived from content; `proven` lives on a student record in `lib/university/state/students/`. Different files, different producers, different lifetimes.

The `status` line is worded *"capabilities taught"*, never *"capabilities covered"* or *"complete"*.

## 9. What remains unchanged

**Metrics that must not move:** `units from corpus: 20` · `teachable: 5` · `missing principle: 7` · `missing practice: 15` · `ambiguous: 3` · beat distribution `1/4 ×5, 2/4 ×12, 3/4 ×3` · `evidencing units: 3` · `students: 0` · `curriculum version 1.0.0 (APPROVAL PENDING)`.

**Code that must not be touched:** `findPractice()` · `findPrinciple()` · `classify()` · `buildUnits()` beat computation · the `teachable` definition · `graph.mjs` `unlocked()` / `nextProofTasks()` · `progress.mjs` `proveCapability()` / `certify()` · `assessment.mjs` in full · `research.mjs`.

**Data that must not be touched:** all six files in `lib/university/data/` — `competencies.json`, `capabilities.json`, `rules.json`, `rubric.json`, `certification.json`, `governance.json`.

**Content that must not be touched:** no lesson, no failure doc, no lab, no `related_docs`.

## 10. Minimal file-level diff proposal — NOT APPLIED

**Three files. No new files. No data changes. No content changes.**

**(a) `lib/university/engine/corpus.mjs`** — extend `readTracksTs()` return

```js
  const idRe = /\bid:\s*'([a-z0-9-]+)'/g
  while ((m = idRe.exec(src)) !== null) lessonIds.push(m[1])

+ // Lesson -> University capability, declared by `proves` on the lesson entry.
+ // Lesson entries are one object per line, so this is parsed per line.
+ // Teaching is not proving: this records instruction, never student attainment.
+ const lessonCapabilities = []
+ for (const line of src.split('\n')) {
+   const id = line.match(/\bid:\s*'([a-z0-9-]+)'/)
+   const pr = line.match(/\bproves:\s*\[([^\]]*)\]/)
+   if (!id || !pr) continue
+   const caps = pr[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
+   if (caps.length) lessonCapabilities.push({ lessonId: id[1], capabilities: caps })
+ }
- return { tracks, lessonIds: [...new Set(lessonIds)] }
+ return { tracks, lessonIds: [...new Set(lessonIds)], lessonCapabilities }
```

**(b) `lib/university/engine/graph.mjs`** — one pure function (this module already owns `loadCapabilities()`)

```js
+/**
+ * Which capabilities have instruction. Content-level only.
+ * `taught` is NOT `proven` - a capability is proven by a student artefact
+ * (see progress.mjs proveCapability). This never influences unlocked().
+ */
+export function capabilityCoverage(capabilities, lessonCapabilities) {
+  const byCap = new Map()
+  for (const { lessonId, capabilities: caps } of lessonCapabilities) {
+    for (const c of caps) {
+      if (!byCap.has(c)) byCap.set(c, [])
+      byCap.get(c).push(lessonId)
+    }
+  }
+  const unknown = [...byCap.keys()].filter(c => !capabilities.some(x => x.id === c))
+  return {
+    capabilities: capabilities.map(c => ({
+      id: c.id, competency: c.competency,
+      taught: byCap.has(c.id),
+      teaching_assets: byCap.get(c.id) ?? [],
+    })),
+    taught_count: capabilities.filter(c => byCap.has(c.id)).length,
+    unknown,   // a `proves` value with no matching capability - reported, never guessed
+  }
+}
```

**(c) `lib/university/university.mjs`** — one line in `status`, one block in `gaps`

```js
// cmds.status, after the capabilities line
+ const cov = capabilityCoverage(caps, corpus().tracksTs.lessonCapabilities)
+ p(`capabilities taught: ${cov.taught_count} of ${caps.length}`)

// cmds.gaps, appended after the existing two sections
+ const untaught = cov.capabilities.filter(c => !c.taught)
+ p(`Capabilities with NO teaching asset (${untaught.length}):`)
+ for (const c of untaught) p(`    ${c.id.padEnd(28)} ${c.competency}`)
```

**Estimated size:** ~45 added lines, ~1 modified line, 3 files.

**Verification gates:** `tsc --noEmit` · `lib/scam-intel` tests 30/30 · all six read-only commands exit 0 · `curriculum` and `unit` output byte-identical to pre-change · `status` shows exactly one new line · `teachable`, `missing principle`, `missing practice`, unit count all unchanged · `unknown` empty · `lib/university/data` byte-identical · no `state/` · tree delta exactly 3 paths.

## 11. Risks

| Risk | Mitigation |
|---|---|
| `taught` read as `proven` | Name it `taught`; never `covered`/`complete`; label the line *"teaching is not proving"* |
| Coverage leaking into `unlocked()` | `capabilityCoverage()` is pure and called only from `university.mjs` output paths |
| A `proves` typo silently vanishing | The `unknown` array reports unmatched values — consistent with *"reported, never guessed"* |
| Regex fragility if `tracks.ts` reformats | Per-line parse is robust for one-object-per-line entries; `unknown` and a count check surface breakage |
| Scope creep into the `teachable` fix | Explicitly out of scope — separate change |
| Reading `6 of 11` as progress toward certification | `approved_by: "pending"` unchanged; no certificate implication anywhere in the output |

## 12. Recommended order

1. **W3b as specified** — three files, additive reporting, governance class `none`.
2. **Separately:** the `findPractice` false-positive fix (§6), which changes an existing metric and needs its own review.
3. **Then:** new instruction for the untaught capabilities, in the W3-audit order — `detect-production-break` (Operating, mandatory for graduation) → `ship-a-user-surface` (Building, gates two competencies) → `structured-output-contract`.

Not in scope now: the Evidencing pair (research 0/3, ROS-governed), Foundations ungating, certification UI, the project engine that would produce Proof beats.

---

## Appendix — verified state at time of discovery

```
HEAD                : 54e93958dbe45c8fff23d21034dda1829acafc51
lib/university/data : 6 files, byte-identical before and after
state/ directory    : absent
working tree        : 121 entries before; only this report added

competencies 6 · capabilities 11 · units 20 · teachable 5 (honest: 2)
missing principle 7 · missing practice 15 · ambiguous 3 · students 0
beat ceiling 3/4 (proof hardcoded absent, curriculum.mjs:139)

corpus().lessons   consumed by: nothing
corpus().tracksTs  consumed by: nothing
proves arrays in lib/tracks.ts: 9, captured by no existing regex
classifyChange(all false) → { class: 'none' }
```
