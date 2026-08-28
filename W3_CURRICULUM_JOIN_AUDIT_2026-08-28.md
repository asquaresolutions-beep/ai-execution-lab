# W3 — Curriculum Join Audit

**Date:** 2026-08-28 · **HEAD:** `0f95b535072d93253f17a1e578eade525b8bc918`
**Mode:** discovery only. No code, data or content changed. Read-only University commands only (`status`, `gaps`, `curriculum`, `graph`, `research`, `unit`).

---

## 1. Executive verdict

**The Lab runs two curriculum systems that share a repository and nothing else.**

The tracks system (`lib/tracks.ts` + `content/lessons/`) serves 138 routes and 54 available lessons to students. The University engine (`lib/university/`) models 6 competencies, 11 capabilities and 20 units built from `content/failures/`. There is exactly **one** point of contact, and it is inert:

```js
// lib/university/engine/corpus.mjs:74-90
/** Nested lesson folders: content/lessons/<track>/<module>/<lesson>.mdx */
function readLessons() { … }        // lessons ARE read into corpus().lessons
```

A repository-wide search confirms `corpus().lessons` is **never referenced by any other engine module**. Lessons are read and discarded. No unit, beat, capability, graph edge or assessment consults them.

Three consequences follow, and they set the whole of W3:

1. **Zero of 11 capabilities is represented in the engine.** Not zero-with-gaps — literally zero. Both lessons shipped in W1 and W2 are invisible to the University model.
2. **No lesson can ever satisfy a beat as the engine is written.** `rules.json → beat_sources` maps Principle to `content/docs`, Practice to `content/labs`. `content/lessons` is not a beat source for any beat.
3. **The join does not exist as a data structure.** Lesson frontmatter carries exactly five keys — `title`, `tags`, `status`, `description`, `date` — across the 30 lessons that have frontmatter at all. There is no capability field, no competency field, no unit reference. Every occurrence of the words "capability" or "competency" inside `content/lessons/` is ordinary prose.

**The verdict: W3 is not a content problem. It is a single missing edge.** Nine existing lessons already teach six capabilities to a standard the engine would accept if it could see them. The work is to make that relationship expressible, not to write curriculum.

**A second finding, unprompted but material:** the engine's headline figure of *5 teachable units* is inflated. Two of the five rest on tag collisions rather than real pedagogical matches. The honest count is **2**. Section 6 sets out the evidence.

---

## 2. Current University model — as implemented

### Competencies (`competencies.json`)

```
                 FOUNDATIONS  (requires: [])
                        |
        +---------------+---------------+
     BUILDING      INTEGRATING      OPERATING
        +---------------+---------------+
                 +------+------+
             EVIDENCING   DISTRIBUTING
        (both require: building, integrating, operating)
```

`graph` reports: **valid — acyclic, all references resolve.** `operating` carries the note *"The strongest and least-exploited competency."*

### Capabilities (`capabilities.json`)

11 capabilities. Each has `id`, `competency`, `statement`, `proof_task`, `proof_artifact`. Two carry `derived_from_incident`; two carry `governed_by: RESEARCH_STANDARD.md`. Distribution: Foundations 3 · Building 1 · Integrating 2 · Operating 2 · Evidencing 2 · Distributing 1.

### Progression (`graph.mjs:70-97`)

```js
const satisfied = id => certified.has(id) ||
  (capsOf(id).length > 0 && capsOf(id).every(c => proven.has(c.id)))
```

A competency unlocks when every prerequisite is **certified**, or every capability beneath it is **proven**. Proving capabilities is the bypass that makes the tree navigable rather than a queue. Neither `certified` nor `proven` has any producer today — `students: 0`.

### Units and beats (`curriculum.mjs`)

One unit per file in `content/failures/` — 20 units. Four beats:

| Beat | Source | Matching rule |
|---|---|---|
| Incident | `content/failures` | the failure doc itself — always present |
| Principle | `content/docs` | **frontmatter only**: `incident.fm.related_docs` must contain a doc slug |
| Practice | `content/labs` | **≥2 tag overlap** between failure and lab |
| Proof | `null` | `available: false` — *"produced by the project engine"* |

`findPrinciple()` performs no content analysis whatsoever. It is a slug lookup against an array. A perfect principle document that is not listed in `related_docs` does not count.

**`proof` is hardcoded `present: false` for every unit.** Beat completeness is therefore capped at **3/4**, permanently, until a project engine exists. Observed distribution across the 20 units: `1/4 → 5 units · 2/4 → 12 units · 3/4 → 3 units`.

### Assessment and governance

`rubric.json` — three criteria (evidence quality, honesty about the unproven, reproducibility), scored 0–3, **pass mark 2 on every one**, with a `returns` protocol naming criterion / what is missing / what would satisfy it.

`certification.json` — portfolio only: deployed artefact, deliberate incident with log, fix, post-mortem. Graduation: 4 of 6 competencies including Operating, a live system ≥30 days, an accepted corpus contribution, a post-mortem of a failure the student did not cause.

`governance.json` — `curriculum_version: 1.0.0`, `effective_from: 2026-08-09`, **`approved_by: "pending"`** with the note *"Awaiting founder approval before any certificate may be issued."* Change classes: **major** (graph/rubric/graduation/submission requirements, founder approval), **minor** (a unit, capability or project template added), **patch** (source document corrected, classification corrected, wording clarified).

### Research (`research`)

| Study | Stage | Teachable | Reason |
|---|---|---|---|
| `denomination-2026-07` | correction | NO | unpublished + open correction COR-001 |
| `ai-citations-2026-07` | published | NO | open correction COR-003 |
| `recovery-vs-verification-2026-07` | in_validation | NO | not published |

**0 of 3.** Engine's stated reason: *teaching a number under correction propagates the defect.* This is ROS-governed and cannot be unblocked by curriculum work.

---

## 3. Capability → unit → lesson matrix

Legend for **Mapping**: `inferred` = a human can see the relationship; the engine cannot. No mapping anywhere in the repository is explicit.

### Foundations

**`deploy-and-read-logs`** — *"You can deploy a web app to a custom domain and read its build log."*
- Units: `edge-runtime-deployment-failure`, `environment-variable-missing-production`, `dns-subdomain-propagation-delay`
- Lessons: `vercel-for-beginners` (`ai-business-zero-budget/zero-budget-stack/vercel-for-beginners`) · `deployment-pipeline` (`claude-code-operator/vercel-deployment/deployment-pipeline`) · `build-failure-diagnosis` (`claude-code-operator/vercel-deployment/build-failure-diagnosis`)
- Instructional evidence: **yes** for both halves — deploying and reading a build log
- Structure: house lesson format (`LessonMeta`, `LessonObjectives`, procedure sections). No beat structure — lessons do not carry one.
- Mapping: **inferred** · Engine state: **invisible**
- Missing piece: the log-reading half is taught only in the operator track, whose prerequisites are Claude Pro + CLI + programming. A non-programmer cannot reach it. **Category B, with a gating caveat.**

**`version-control-recovery`** — *"You can recover work from git after a mistake, without deleting the repository."*
- Units: none classified to git recovery
- Lesson: `bad-commit-recovery` (`claude-code-operator/github-workflows/bad-commit-recovery`, playbook) — **the only file in the entire corpus containing the string "reflog"**, which is precisely what the proof task demands
- Mapping: **inferred** · Engine state: **invisible**
- Missing piece: operator-gated only. **Category B.**

**`env-separation`** — *"You can explain why a value works locally and fails in production."*
- Units: `environment-variable-missing-production`, `ga4-preview-environment-contamination`, `razorpay-test-live-key-mismatch`
- Lesson: `env-vars-secrets` (`claude-code-operator/vercel-deployment/env-vars-secrets`)
- Mapping: **inferred** · Engine state: **invisible**
- Missing piece: operator-gated only. **Category B.**

### Building

**`ship-a-user-surface`** — *"You can ship a page that a stranger can use without instructions."*
- Unit: `next-mdx-remote-v6-blockjs` (building, 2/4)
- Lessons: **none available.** `landing-page-system` and `mvp-with-claude` are both `coming-soon`.
- Mapping: n/a · Engine state: no asset
- Missing piece: everything. **Category D.** Note this is Building's *only* capability, and Building gates both Evidencing and Distributing.

### Integrating

**`handle-every-api-branch`** — *"You can enumerate every response a third-party API can return and show your handler for each."* · `derived_from_incident: gemini-rate-limit-429-no-ux`
- Unit: `gemini-rate-limit-429-no-ux` — competency `integrating`, **2/4** (incident ✓, principle ✗, practice ✓, proof ✗)
- Lesson: **`connect-gemini-api` — W1** · route `claude-code-operator/model-integration/connect-gemini-api` · live, HTTP 200
- Instructional evidence: **yes, and unusually direct.** The lesson is built from the two failures that produced this capability: `gemini-rate-limit-429-no-ux` and `gemini-json-parse-failure`. Its stated objective — *"handle the two failures that actually take production down"* — is the capability statement in other words.
- Structure: `LessonObjectives`, failure-first narrative, generalised pattern, verification section. Not beat-structured.
- Mapping: **inferred** · Engine state: **invisible**
- Missing piece: **the edge only.** The strongest join candidate in the repository. **Category B.**

**`structured-output-contract`** — *"You can make a language model return output your parser accepts, and prove the failure rate fell."* · `derived_from_incident: gemini-json-parse-failure`
- Unit: `gemini-json-parse-failure` — **3/4**, the most complete unit in the corpus (incident ✓, principle ← `docs/ai-output-structure-validation.mdx`, practice ← `labs/gemini-structured-output-reliability.mdx`, overlap 6)
- Lessons: none dedicated. `connect-gemini-api` covers malformed JSON as one of two failures.
- Mapping: **inferred, partial** · Engine state: **invisible**
- Missing piece: the proof task requires a **before/after parse-failure rate with the prompt diff that caused it**. `connect-gemini-api` teaches handling malformed output; it does not teach measuring a failure rate. The lab does that, but a lab is not instruction. **Category C.**

### Operating

**`detect-production-break`** — *"You can tell that production is broken without a user telling you."*
- Units: 7 primary Operating units — the largest pool in the corpus
- Lessons: **none available.** `ai-ops-monitoring` is `coming-soon`. Doctrine exists as `docs/production-observability-doctrine.mdx`, `docs/execution-observability-design.mdx`, `playbooks/incident-detection-playbook.mdx` — none of which is instruction.
- Mapping: n/a · Engine state: no asset
- Missing piece: a lesson. **Category D — and the highest-value one**, because Operating is mandatory for graduation.

**`write-a-postmortem`** — *"You can write a post-mortem a stranger could act on."*
- Units: applies across all 20 — the post-mortem is the assessment instrument for every one
- Lesson: **`post-mortem-process` — W2** · route `claude-code-operator/debugging-recovery/post-mortem-process` · live, HTTP 200, 1,857 words
- Instructional evidence: **yes, and it is rubric-aware.** The lesson teaches the six-section format from `content/_templates/failure-report.mdx`, reproduces all three rubric criteria with their `fails_when` clauses and the 0–3 scale, explains the `returns` protocol, and teaches the graduation-relevant skill of writing about a failure the learner did not cause. It also states explicitly that no certificates are being issued while `approved_by` is pending.
- Structure: closest thing in the corpus to beat awareness — it teaches Evidence-vs-assumption and the assessment criteria directly. Still not beat-structured.
- Mapping: **inferred** · Engine state: **invisible**
- Missing piece: **the edge only.** **Category B.**

### Evidencing

**`claim-with-dataset`** — *"You can state a measured claim and attach the data behind it."* · `governed_by: RESEARCH_STANDARD.md`
- Unit: `ga4-cross-domain-tracking-gap` (evidencing, 2/4)
- Lessons: none. `google-analytics-data-thinking` teaches metric selection, not claim construction.
- Engine state: **blocked** — research 0/3 teachable
- Missing piece: a lesson, but the evidence base it would draw on is under correction. **Category D, externally blocked.**

**`falsifiable-claim`** — *"You can state what observation would have proved you wrong."* · `governed_by: RESEARCH_STANDARD.md`
- Units: none
- Lessons: none
- Engine state: **blocked** — same
- **Category D, externally blocked.**

### Distributing

**`measure-findability`** — *"You can show whether something you published was actually found."*
- Units: `gsc-index-coverage-drop` (distributing, 2/4), `litespeed-client-cache-bypass-ignored`
- Lessons: `google-search-console-setup` (`ai-business-zero-budget/zero-budget-stack/google-search-console-setup`, playbook) · `google-analytics-data-thinking` (same module)
- Instructional evidence: **partial.** Both teach obtaining impressions and choosing metrics.
- Mapping: **inferred** · Engine state: **invisible**
- Missing piece: the proof task ends *"and say what you cannot conclude from it."* Neither lesson teaches stating a limitation. **Category B for the measurement half, C for the limitation half.**

---

## 4. Lesson → capability reverse matrix

All 54 available lessons are invisible to the University engine. The question is which *should* be joined.

### Lessons that should be joined (9)

| Lesson | Route | Supports | Explicit? |
|---|---|---|---|
| `connect-gemini-api` | `claude-code-operator/model-integration/…` | `handle-every-api-branch` | no |
| `post-mortem-process` | `claude-code-operator/debugging-recovery/…` | `write-a-postmortem` | no |
| `bad-commit-recovery` | `claude-code-operator/github-workflows/…` | `version-control-recovery` | no |
| `env-vars-secrets` | `claude-code-operator/vercel-deployment/…` | `env-separation` | no |
| `deployment-pipeline` | `claude-code-operator/vercel-deployment/…` | `deploy-and-read-logs` | no |
| `build-failure-diagnosis` | `claude-code-operator/vercel-deployment/…` | `deploy-and-read-logs` | no |
| `vercel-for-beginners` | `ai-business-zero-budget/zero-budget-stack/…` | `deploy-and-read-logs` | no |
| `google-search-console-setup` | `ai-business-zero-budget/zero-budget-stack/…` | `measure-findability` | no |
| `google-analytics-data-thinking` | `ai-business-zero-budget/zero-budget-stack/…` | `measure-findability` | no |

**9 lessons → 6 capabilities.**

### Lessons that should remain ordinary Lab content (45)

The remaining 45 available lessons map to no capability, and forcing a mapping would corrupt the model. They fall into four groups:

- **Track-specific pedagogy with no capability analogue** — the 12 `ai-for-students` lessons (learning technique, citation integrity, portfolio building), `avoid-tool-subscription-traps`, `adsense-approval-reality`, `choosing-your-product`, `ai-tool-stack-budget`. These teach judgement, not a provable production capability.
- **Claude Code tooling** — `dev-environment`, `claude-md-architecture`, `project-settings`, `ide-integration`, `first-agentic-task`, `choosing-your-ai-engineering-stack`, the four prompt-engineering lessons, `feature-planning-claude`, `multi-agent-orchestration`. Real instruction, but the capability set contains no "operate Claude Code" capability, and **inventing one is out of scope.**
- **WordPress REST operations** — `wp-auth-patterns`, `content-patching-system`, `bulk-operations`, `error-handling-rollback`. Arguably adjacent to `handle-every-api-branch`, but that capability is `derived_from_incident: gemini-rate-limit-429-no-ux` and its proof task concerns model/third-party API branches. Mapping WordPress lessons to it would dilute a capability that is deliberately narrow.
- **Debugging and GEO** — `debugging-methodology`, `reading-build-errors`, `git-operations`, `branch-strategy`, `pr-review-workflow`, `geo-vs-seo`, `rag-pipeline`, `citation-signals`, `first-organic-traffic-system`, `free-tier-architecture`, `github-for-non-developers`, `claude-wordpress-workflow`. Valuable; no capability they satisfy end-to-end.

**This is the most important restraint in the audit.** A join that maps 54 lessons to 11 capabilities produces a model where every capability looks satisfied and none is proven. Nine is the honest number.

---

## 5. Explicit vs inferred mappings

**Explicit mappings that exist in the repository: 0.**

Every relationship in sections 3 and 4 is inferred by reading prose. The repository contains exactly three kinds of explicit, machine-readable link, and none connects a lesson to a capability:

| Link | Direction | Where | Count |
|---|---|---|---|
| `related_docs` | failure → doc | failure frontmatter | 13 of 20 failures |
| tag overlap ≥2 | failure ↔ lab | both frontmatters | 5 matches |
| `derived_from_incident` | capability → failure | `capabilities.json` | 2 of 11 capabilities |

The third is the interesting one. `handle-every-api-branch` and `structured-output-contract` already point at their originating incidents. **The capability→unit edge exists for 2 of 11.** What is missing everywhere is capability→lesson.

Lesson frontmatter offers no hook: five keys, and 24 of 54 lessons have no frontmatter at all. `lib/tracks.ts` is the only complete metadata source for lessons — which is exactly why `corpus.mjs:6` documents parsing it as a second source.

---

## 6. Why the engine reports only 5 teachable units

`teachable = beats.incident.present && beats.practice.present`. Incident is always present, so **teachable is entirely determined by Practice**, and Practice requires ≥2 tag overlap with a document in `content/labs/` — of which there are **5**.

Three of those five labs are domain-narrow (`2026-05-18-geo-entity-density-experiment`, `quickfix-semantic-html-ai-extraction`, and to a degree `wordpress-ecosystem-rollout-evidence`). Effectively **3 labs supply all 5 practice beats, and one lab supplies three of them.**

The five matches, with their actual shared tags:

| Unit | Lab | Overlap | Shared tags | Genuine? |
|---|---|---|---|---|
| `gemini-json-parse-failure` | `gemini-structured-output-reliability` | 6 | gemini, firebase-functions, json, structured-output, scamcheck, +1 | ✅ **yes** |
| `litespeed-client-cache-bypass-ignored` | `litespeed-ucss-scoped-css-stripping` | 2 | litespeed, wordpress | ✅ **yes** — same subsystem |
| `gemini-rate-limit-429-no-ux` | `gemini-structured-output-reliability` | 3 | gemini, firebase-functions, scamcheck | ⚠ **weak** — the lab is about structured output, not rate limits |
| `firebase-deploy-sequence-auth-failure` | `gemini-structured-output-reliability` | 2 | firebase-functions, trustseal | ❌ **false positive** |
| `wordpress-sitemap-404` | `wordpress-ecosystem-rollout-evidence` | 2 | wordpress, seo | ❌ **false positive** |

A Firebase **deploy-sequence auth** failure is not practised by a **Gemini structured-output** lab; they share a platform tag and a product tag. A **sitemap 404 / rewrite-rules** failure is not practised by a **schema-org rollout evidence archive**; they share "wordpress" and "seo".

**The honest teachable count is 2, not 5.** The `win_margin`/`secondary_floor` tuning that governs competency classification has no analogue in `findPractice` — a flat threshold of 2 over a shared vocabulary where platform tags (`wordpress`, `firebase-functions`, `scamcheck`, `trustseal`) are common produces collisions by construction.

This matters for W3 because *"5 teachable"* is the number most likely to be quoted as progress, and it overstates the corpus by 2.5×.

---

## 7. Gaps that existing lessons can close without new content

**Six capabilities, nine lessons, zero words written.**

`handle-every-api-branch` · `write-a-postmortem` · `version-control-recovery` · `env-separation` · `deploy-and-read-logs` · `measure-findability`

Every one already has instruction live in production that a reader would accept as teaching the capability. What is absent is a machine-readable edge.

Two caveats that must ship with this claim:

1. **Four of the nine lessons sit behind the operator track's prerequisites** — Claude Pro subscription, terminal comfort, programming knowledge. All three Foundations capabilities are provable *only* from operator-gated content. The join makes the relationship visible; it does not make Foundations reachable for a non-programmer. That remains a separate problem.
2. **`measure-findability` is joined at the measurement half only.** Its proof task ends *"and say what you cannot conclude from it"*, which no lesson teaches.

---

## 8. Gaps that genuinely require new lessons

**Four capabilities. Two actionable, two externally blocked.**

| Capability | Competency | Status | Note |
|---|---|---|---|
| `detect-production-break` | Operating | **actionable** | Highest value. Operating is mandatory for graduation. Source material exists as three doctrine docs and a `coming-soon` slot (`ai-ops-monitoring`). |
| `ship-a-user-surface` | Building | **actionable** | Building's only capability, and it gates Evidencing and Distributing. Two `coming-soon` slots exist. |
| `claim-with-dataset` | Evidencing | **blocked** | Research 0/3 teachable — COR-001, COR-003 open |
| `falsifiable-claim` | Evidencing | **blocked** | Same |

One partial: **`structured-output-contract`** (Category C) needs a lesson teaching before/after failure-rate measurement. The lab and doc exist; instruction does not.

The Evidencing pair should not be written from the study pipeline while corrections are open — the engine's own reasoning is that *teaching a number under correction propagates the defect*. If Evidencing is to be unblocked without waiting on the ROS, it would have to draw on operational evidence rather than published studies. **That is a decision, not a task, and it is outside W3.**

---

## 9. Mappings that should NOT be made

1. **Do not join all 54 lessons.** 45 have no capability they satisfy end-to-end. A model where every capability appears covered and none is proven is worse than an empty one.
2. **Do not map WordPress REST lessons to `handle-every-api-branch`.** That capability is `derived_from_incident: gemini-rate-limit-429-no-ux` and its proof task concerns model/third-party API branch handling. Widening it dilutes a deliberately narrow definition.
3. **Do not invent a "Claude Code operator" capability** to absorb the 15 tooling lessons. Adding a capability is a **minor** change under `governance.json` requiring curriculum-owner approval, and W3 was scoped to join what exists.
4. **Do not make lessons a beat source.** Beats are Incident/Principle/Practice/Proof over failures, docs and labs. Lessons are a different axis — a capability is *taught* by a lesson and *proven* by an artefact. Conflating them would make `teachable` meaningless.
5. **Do not backfill frontmatter into the 24 lessons that lack it.** `lib/tracks.ts` is already the metadata source of record and `corpus.mjs` documents this. The join belongs there.
6. **Do not treat a joined capability as a proven one.** `proven` is produced by a student submitting a proof artefact. Teaching ≠ proving, and `graph.mjs` depends on that distinction.
7. **Do not "fix" the two false-positive practice matches by retuning `findPractice` during W3.** That changes what counts as teachable — arguably a graph-adjacent change. Raise it separately.

---

## 10. Recommended W3 implementation order

**W3a — the edge.** Add an optional `proves?: string[]` field to the `Lesson` interface in `lib/tracks.ts`, populate it on the 9 lessons in section 7, and have the engine read it via the `tracks.ts` parse that `corpus.mjs` already performs. No new file, no new data directory, no content written. This is the entire join.

**W3b — read-only reporting.** Extend the existing `status`/`gaps` output to report capability coverage: which capabilities have a teaching asset, which do not. The engine already reports rather than authors; this is consistent.

**W3c — the two false positives.** Decide whether `findPractice` should require more than a flat overlap of 2. Governance class is arguable; treat as a separate approval.

**W3d — new instruction**, in this order: `detect-production-break` (Operating, mandatory for graduation) → `ship-a-user-surface` (Building, gates two competencies) → `structured-output-contract` (completes Integrating).

**Not in W3:** the Evidencing pair, the Foundations ungating problem, certification UI, the project engine that would produce Proof beats.

---

## 11. Risks and governance constraints

| Item | Detail |
|---|---|
| **Governance class of W3a** | Ambiguous. `governance.json` change classes cover units, capabilities, rubric, graduation and the graph. Adding a *mapping field to `lib/tracks.ts`* fits none cleanly. Nearest reading is **patch** ("a classification is corrected"), since the relationship already exists and is merely being recorded. **This needs the curriculum owner's call before implementation.** |
| **`approved_by: "pending"`** | No certificate may be issued. W3a does not change this and must not be described as progress toward certification. |
| **Research 0/3** | Evidencing unbuildable from studies. ROS-governed, not ours. |
| **`proof.available: false`** | 3/4 is the permanent ceiling until a project engine exists. Any roadmap metric phrased as "units at 4/4" is unreachable by construction. |
| **Overstated teachability** | The "5 teachable" figure should not be quoted without the section-6 caveat. |
| **Foundations gating** | The join records that three Foundations capabilities are taught. It does not record that all three are taught only behind a paid-subscription, programming-required prerequisite. Reporting must not imply Foundations is open. |
| **Dilution risk** | The strongest failure mode for W3 is joining too much. Nine, not fifty-four. |

---

## 12. Minimal proposed diff — NOT APPLIED

For the next phase only. **Nothing below has been written to any file.**

```ts
// lib/tracks.ts — interface change (1 optional field)
 export interface Lesson {
   id:          string
   title:       string
   type:        LessonType
   duration:    string
   description: string
   status:      ContentStatus
+  /** University capability ids this lesson teaches. Teaching is not proving —
+   *  proof comes from a student artefact. See lib/university/data/capabilities.json */
+  proves?:     string[]
 }
```

Then `proves` added to exactly nine existing lesson entries:

```
connect-gemini-api              proves: ['handle-every-api-branch']
post-mortem-process             proves: ['write-a-postmortem']
bad-commit-recovery             proves: ['version-control-recovery']
env-vars-secrets                proves: ['env-separation']
deployment-pipeline             proves: ['deploy-and-read-logs']
build-failure-diagnosis         proves: ['deploy-and-read-logs']
vercel-for-beginners            proves: ['deploy-and-read-logs']
google-search-console-setup     proves: ['measure-findability']
google-analytics-data-thinking  proves: ['measure-findability']
```

**Scope:** one file, one interface field, nine data lines. No lesson content. No `lib/university/` change. No new capability, unit, competency or assessment rule. Engine reporting (W3b) is a separate change on top.

**Verification gates for that phase:** `tsc --noEmit` · `next build` · `getAllLessonPaths()` unchanged at 138 · available count unchanged at 54 · University `status` unchanged · every `proves` value resolves against `capabilities.json` · tree delta exactly 1 path.

---

## Appendix — engine state at time of audit

```
curriculum version : 1.0.0  (APPROVAL PENDING)
competencies       : 6   capabilities: 11
units from corpus  : 20   teachable: 5   (honest count: 2 — see §6)
evidencing units   : 3
students           : 0
missing principle  : 7
missing practice   : 15
ambiguous          : 3
beat distribution  : 1/4 ×5 · 2/4 ×12 · 3/4 ×3   (4/4 unreachable)

lessons available  : 54    routes: 138
lessons with frontmatter : 30 / 54
explicit lesson→capability mappings : 0
```
