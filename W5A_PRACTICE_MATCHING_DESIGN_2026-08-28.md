# W5a — Practice Matching Design

**Date:** 2026-08-28 · **HEAD:** `1ccbbf112ac0fa201597ad24eecd1b3c841f7cf7`
**Phase:** design only. No source, content or data modified. Read-only commands; `governance`, `student`, `prove`, `assess` **not run** (governance computed by calling the pure `classifyChange()` function).

---

## Executive summary

Reading every lab against every failure document — rather than comparing tags — the honest Practice count is **1, not 5, and not the 2 my own W5 audit estimated.**

Four of the five current matches are wrong at the mechanism level, and one of the four is a match I twice called genuine. Correcting the record is part of this design.

| Unit | Matched lab | Overlap | Earlier call | **Verdict on reading both documents** |
|---|---|---|---|---|
| `gemini-json-parse-failure` | gemini reliability | 6 | genuine | ✅ **GENUINE** |
| `litespeed-client-cache-bypass-ignored` | litespeed UCSS | 2 | *"genuine — same subsystem"* | ❌ **FALSE POSITIVE** — different mechanism |
| `gemini-rate-limit-429-no-ux` | gemini reliability | 3 | weak | ❌ **UNRELATED** |
| `firebase-deploy-sequence-auth-failure` | gemini reliability | 2 | false positive | ❌ **FALSE POSITIVE** |
| `wordpress-sitemap-404` | wp rollout evidence | 2 | false positive | ❌ **FALSE POSITIVE** |

**Correction to my earlier reports.** In W3 §6 and again in W5 §6 I recorded `litespeed-client-cache-bypass-ignored ← litespeed-ucss-scoped-css-stripping` as a genuine match on the reasoning "same subsystem." That was tag-level reasoning of exactly the kind this design exists to remove. The failure is *LiteSpeed Cache ignoring client `no-cache` headers and serving stale HTML*; the lab is *the LiteSpeed UCSS optimizer stripping `.postid-XXXX` scoped CSS*. Same vendor, different subsystem, different mechanism. Reproducing the second does not reproduce the first.

**Proposed fix:** an explicit `reproduces:` key on labs holding incident **slugs**, resolved the same way `related_docs` already resolves the Principle beat. Tag inference is removed entirely.

**Expected effect: `teachable` 5 → 1, `missing practice` 15 → 19.** Both numbers get worse and both become true.

---

## 1. Current `findPractice()` behaviour

`lib/university/engine/curriculum.mjs:93-104`:

```js
/** Match a lab to an incident by shared tags - the Practice beat. */
function findPractice(incident, labs) {
  const iTags = new Set((incident.fm.tags ?? []).map(t => String(t).toLowerCase()))
  let best = null
  let bestOverlap = 0
  for (const lab of labs) {
    const lTags = (lab.fm.tags ?? []).map(t => String(t).toLowerCase())
    const overlap = lTags.filter(t => iTags.has(t)).length
    if (overlap > bestOverlap) { best = lab; bestOverlap = overlap }
  }
  return bestOverlap >= 2 ? { doc: best, overlap: bestOverlap } : null
}
```

Four properties make it unsafe:

1. **Flat threshold, no weighting.** Two shared tags is two shared tags, whether they are `gemini`+`json` or `wordpress`+`seo`.
2. **No ambiguity reporting.** Contrast `classify()` (`curriculum.mjs:16-91`), which carries `win_margin: 2`, a `secondary_floor`, weighted signals (`tag:3, failure_type:2, system:2, title_keyword:1`) and returns `status: 'ambiguous'` rather than guessing. `findPractice()` has none of that — it silently takes the argmax.
3. **Vocabulary collision by construction.** The tag set mixes *technology* (`wordpress`, `firebase-functions`), *product* (`scamcheck`, `trustseal`) and *activity* (`deployment`, `experiment`). Any two documents from the same product collide at 2.
4. **Semantic mismatch.** Tags describe *where a thing happened*. Practice requires *the same failure being deliberately re-caused*. Those are different questions, and no tag vocabulary can answer the second.

Compare the sibling beat: `findPrinciple()` (`curriculum.mjs:106-113`) does **no inference at all** — it is a slug lookup against `incident.fm.related_docs`. The Principle beat is explicit; the Practice beat guesses. **That asymmetry is the defect.**

---

## 2. The exact false positives, resolved against source

### ✅ GENUINE — `gemini-json-parse-failure` ← `gemini-structured-output-reliability`

- **Failure:** *"Gemini API Returns Malformed JSON — Cloud Function Parse Failure."*
- **Lab hypothesis:** *"…then parse failure frequency (SyntaxError on JSON.parse) will decrease from ~6% observed baseline to under 1%."*

Same system, same failure mode, same measured signal. The lab is a deliberate re-causing and reduction of exactly this incident. **Overlap 6, and the relationship is real independently of the tags.**

### ❌ FALSE POSITIVE — `litespeed-client-cache-bypass-ignored` ← `litespeed-ucss-scoped-css-stripping`

- **Failure:** *"LiteSpeed Cache Ignores Client no-cache Headers."* A WPCode PHP filter was deployed; `curl` with `Cache-Control: no-cache` still returned stale HTML; the fix appeared not to work but had worked. Sections: *The False Negative*, *How LiteSpeed Cache Works*.
- **Lab hypothesis:** *"LiteSpeed UCSS strips `.postid-XXXX` scoped CSS rules, making Kit CSS and any scoped stylesheet fix invisible to browsers."*

**Cache serving vs CSS optimisation.** Shared tags: `litespeed`, `wordpress`. A student who reproduces UCSS stripping has not reproduced a stale-cache false negative. **This is the match I previously mis-called; the lab is a genuine experiment, but of a different phenomenon.**

### ❌ UNRELATED — `gemini-rate-limit-429-no-ux` ← `gemini-structured-output-reliability`

- **Failure:** a 429 rate limit with no client branch → infinite spinner.
- **Lab:** output *format* reliability. It does not mention rate limits anywhere in its experimental design.

Shared tags: `gemini`, `firebase-functions`, `scamcheck` — all three describe the product, not the failure. **Classified honestly: unrelated.** Note the irony — the capability `handle-every-api-branch` is `derived_from_incident: gemini-rate-limit-429-no-ux`, so this unit matters, and it currently claims a practice beat it does not have.

### ❌ FALSE POSITIVE — `firebase-deploy-sequence-auth-failure` ← `gemini-structured-output-reliability`

- **Failure:** *"Firebase Functions 403 After Redeploy — Firestore Rules Deployment Order."* Functions deployed before Rules; 12-minute window of stale IAM state.
- **Lab:** Gemini JSON output formatting.

Shared tags: `firebase-functions`, `trustseal`. A deployment-ordering race and a prompt-formatting experiment have nothing in common.

### ❌ FALSE POSITIVE — `wordpress-sitemap-404` ← `wordpress-ecosystem-rollout-evidence`

- **Failure:** sitemap 404 caused by a stale WordPress rewrite-rules cache.
- **"Lab":** 4,164 words, hypothesis *"Structured visual evidence of a production rollout is more durable and machine-readable than narrative documentation alone."*

This document **is not a reproduction experiment at all** — it is a visual evidence archive with 17 sections of screenshots. Shared tags: `wordpress`, `seo`.

### The other two labs reproduce nothing

| Lab | `result` | Subject |
|---|---|---|
| `quickfix-semantic-html-ai-extraction` | **ongoing** | whether semantic HTML improves AI fact extraction |
| `2026-05-18-geo-entity-density-experiment` | **ongoing** | whether entity density increases citation frequency |

Both are GEO experiments about the Lab's own publishing, not reproductions of any incident. Neither currently matches anything, and neither should.

**Corpus reality: of five labs, one reproduces a documented incident. One (litespeed) is a genuine experiment whose phenomenon has no failure document. Three reproduce nothing.**

---

## 3. Explicit relationship design

### The repository already has this pattern — do not invent one

Relationship keys already in use across the 20 failure documents:

| Key | Uses | Holds |
|---|---|---|
| `linked_incidents` | 16 | **incident slugs** |
| `related_docs` | 15 | doc slugs — **drives the Principle beat** |
| `related_case_studies` | 15 | case-study slugs |
| `related_logs` | 12 | log slugs |
| `related_failures` | 8 | failure slugs |
| `deployment_ref` | 7 | log slug |

Every one is a **list of slugs resolved by name**. `findPrinciple()` consumes `related_docs` with `refs.includes(d.slug)`. **`reproduces:` is the same pattern pointed the other way** — from a lab to the incidents it re-causes.

### Identifier: incident slug

Confirmed from `corpus.mjs:64` — `slug` is the filename without `.mdx`:

```
slug="gemini-json-parse-failure"   path=content/failures/gemini-json-parse-failure.mdx
```

**Use slugs, not paths, not IDs, not titles.** Paths duplicate a directory the reader already knows and break on any move; slugs are what every other relationship key in the corpus uses.

### Direction: on the lab, not the incident

`reproduces:` belongs on the **lab**, for three reasons:

1. A lab is authored *after* the incident, knowing what it reproduces. The incident cannot know about a lab that does not yet exist.
2. It keeps the 20 failure documents untouched — a hard non-goal below.
3. It mirrors the authoring workflow the engine already prints: *"needed: a lab sharing at least 2 tags with content/failures/&lt;incident&gt;.mdx"* becomes *"needed: a lab declaring `reproduces: [&lt;incident&gt;]`"*.

### Proposed schema

```yaml
# content/labs/<lab>.mdx frontmatter
reproduces:
  - gemini-json-parse-failure
```

Inline form also parses: `reproduces: [gemini-json-parse-failure]`.

**One lab may reproduce several incidents** (the list is a list). **Several labs may reproduce one incident** — in which case a deterministic tie-break is needed; recommend *first by slug order*, reported, never scored.

**Parser support required: none.** `frontmatter()` (`corpus.mjs:21-45`) already handles both block lists (`^\s+-\s+`) and inline arrays (`v.startsWith('[')`). Verified against `related_docs`, which uses the identical shape today. `readFolder('labs')` already parses lab frontmatter into `lab.fm`.

---

## 4. All existing lab → incident relationships

The complete, honest map after reading every document:

```yaml
gemini-structured-output-reliability:
  reproduces: [gemini-json-parse-failure]

litespeed-ucss-scoped-css-stripping:
  reproduces: []        # genuine experiment; no matching incident in the corpus
                        # (it reproduces UCSS scoped-CSS stripping, which has no failure doc)

wordpress-ecosystem-rollout-evidence:
  reproduces: []        # visual evidence archive, not a reproduction

quickfix-semantic-html-ai-extraction:
  reproduces: []        # ongoing GEO experiment

2026-05-18-geo-entity-density-experiment:
  reproduces: []        # ongoing GEO experiment
```

**One relationship in the entire corpus.**

A design question worth surfacing: should a lab with no reproduction relationship carry `reproduces: []` explicitly, or omit the key? **Recommend omitting.** An absent key and an empty list behave identically in the parser (`v === '' → []`), and adding an empty key to four labs is metadata noise. Omission also keeps four of the five labs entirely untouched.

---

## 5. Expected before / after

Simulated in memory, read-only, no file written:

| | Current (tag ≥2) | After (explicit) |
|---|---|---|
| Practice matches | **5** | **1** |
| `teachable` | **5** | **1** |
| `missing practice` | **15** | **19** |
| False positives | **4** | **0** |
| Units at 3/4 | 3 | **1** (`gemini-json-parse-failure`) |
| Units at 2/4 | 12 | 13 |
| Units at 1/4 | 5 | 6 |

Per-unit changes:

| Unit | Before | After |
|---|---|---|
| `gemini-json-parse-failure` | 3/4 teachable | **3/4 teachable** (unchanged, now provably so) |
| `firebase-deploy-sequence-auth-failure` | 3/4 teachable | 2/4 not teachable |
| `wordpress-sitemap-404` | 3/4 teachable | 2/4 not teachable |
| `gemini-rate-limit-429-no-ux` | 2/4 teachable | 1/4 not teachable |
| `litespeed-client-cache-bypass-ignored` | 2/4 teachable | 1/4 not teachable |

**Every other unit is unchanged.** Competency classification, Principle beats, `proves` mappings and instructional coverage (9/11) are untouched — this changes one beat only.

---

## 6. Files that would change

| File | Change | Size |
|---|---|---|
| `lib/university/engine/curriculum.mjs` | replace `findPractice()` body with a `reproduces` lookup; update the `practice` beat's `gap` text and swap `tag_overlap` for `via: 'reproduces'` | ~12 lines |
| `content/labs/gemini-structured-output-reliability.mdx` | add `reproduces: [gemini-json-parse-failure]` to frontmatter | 2 lines |
| `lib/university/data/rules.json` | update `beat_sources.practice.note` to describe explicit declaration | 1 string |

**Three files. No parser change. No new file. Four of five labs untouched. All 20 failure documents untouched.**

Proposed replacement:

```js
/** Match a lab to an incident by explicit declaration - the Practice beat.
 *  A lab names the incidents it reproduces; nothing is inferred from tags.
 *  Mirrors findPrinciple(), which resolves related_docs by slug. */
function findPractice(incident, labs) {
  const hit = labs.find(l => (l.fm.reproduces ?? []).includes(incident.slug))
  return hit ? { doc: hit, via: 'reproduces' } : null
}
```

`reproductionTask()` (`assessment.mjs:130`) needs no change — it reads `beats.practice.present` and `.source` only. Its `needed:` string should be updated for accuracy, which is a one-line copy change inside that function.

---

## 7. Governance

Computed with the real `classifyChange()`:

| Action | Class | Version | Requires |
|---|---|---|---|
| Add `reproduces:` to a lab (metadata) | **patch** | 1.0.1 | curriculum_owner_approval |
| Change the `findPractice()` matching rule | **patch** | 1.0.1 | curriculum_owner_approval |
| Parser support in `corpus.mjs` (not needed) | none | 1.0.0 | — |

**Combined classifier result: `patch`.**

**Architectural impact — larger than the class suggests, and the classifier cannot see it.** `classifyChange()` accepts exactly six inputs: `graphChanged`, `graduationChanged`, `rubricChanged`, `unitAdded`, `capabilityAdded`, `corrected`. **There is no input representing "a beat-matching rule changed."** So a change that redefines `teachable` across all 20 units lands in the same bucket as fixing a typo in a doc slug.

Recommendation: implement as **patch with explicit notice** — record the before/after counts (5→1, 15→19) in the commit message so the metric shift is visible in history rather than discovered later. Do **not** amend `governance.json`; do not add a change class. Extending the classifier is a separate proposal.

---

## 8. Regression risks

| Risk | Assessment |
|---|---|
| `teachable` drops 5 → 1 and reads as a regression | **Certain, and intended.** Must be stated in the commit message and anywhere the number is quoted. |
| A future lab omits `reproduces` and silently matches nothing | **Real.** Mitigated because the engine already prints what is needed. Recommend `gaps` reporting labs with no `reproduces` key — a small additive change, not required for W5a. |
| A `reproduces` slug typo silently matches nothing | **Real.** Mirrors the same weakness in `related_docs`. Recommend reporting unresolvable slugs the way `capabilityCoverage()` reports `unknown` — additive, out of scope for W5a. |
| Two labs claim the same incident | Not possible today (one relationship). Needs a deterministic tie-break before a second lab lands. |
| `curriculum` / `unit` output changes | **Expected and unavoidable** — this is the point. Those byte-identity gates, used in W2–W4c, **must be replaced** for W5a by an explicit expected-diff check. |
| Instructional coverage moves | **No.** 9/11 and the 12 `proves` mappings are independent of beats. |
| Units lost or reclassified | **No.** 20 units, same competencies; only `beats.practice` changes on five. |
| Ambiguity handling lost | **No** — there is nothing to disambiguate once matching is explicit. |

---

## 9. Explicit non-goals

1. **Do not author any lab.** That is W5b.
2. **Do not edit `content/failures/` at all** — no tags, no `related_docs`, no `linked_incidents`.
3. **Do not change incident tags** anywhere; tags stay as classification signal for `classify()`, which is unaffected.
4. **Do not touch `classify()`, `win_margin`, `secondary_floor` or weights.**
5. **Do not touch lesson `proves`, capabilities, competencies, units, graph, rubric, certification, graduation or student state.**
6. **Do not redefine `teachable`.** Its formula (`incident && practice`) is unchanged; only the input becomes honest.
7. **Do not add a `reproduces: []` key to labs that reproduce nothing.**
8. **Do not touch the Proof beat.** Still hardcoded absent; still correct.
9. **Do not extend `classifyChange()`** — noted in §7, proposed separately.
10. **Do not batch in** the soft-404, eval C: paths, ROS, Evidencing, `related_docs` links or the untracked reports.

---

## 10. Working-tree integrity

```
HEAD                : 1ccbbf112ac0fa201597ad24eecd1b3c841f7cf7   sync 0/0   staged 0
lib/university      : 15 files, byte-identical
content/labs        : 5 files, byte-identical
content/failures    : 20 files, byte-identical
lib/tracks.ts       : unchanged        content/lessons : unchanged
state/ directory    : absent
mutating commands   : governance/student/prove/assess NOT run
working tree        : 126 entries before; only this report added
```

---

## Recommended implementation, if approved

1. Add `reproduces: [gemini-json-parse-failure]` to `content/labs/gemini-structured-output-reliability.mdx`
2. Replace `findPractice()` in `lib/university/engine/curriculum.mjs` (~12 lines)
3. Update the `practice` beat's `gap` string and the `note` in `rules.json`
4. Verify: `teachable` 5→1 · `missing practice` 15→19 · units still 20 · competencies unchanged · coverage still 9/11 · 12 mappings undrifted · `tsc` · tests 30/30 · six commands exit 0 · **expected-diff check replacing the byte-identity gate**
5. Commit as **patch with notice**, recording the count change in the message

**One relationship declared, four false ones removed, and a number that finally means what it says.**
