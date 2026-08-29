# W5 — Next Action Audit

**Date:** 2026-08-28 · **HEAD:** `1ccbbf112ac0fa201597ad24eecd1b3c841f7cf7`
**Preceding:** W4 closed at 9/11 instructional capabilities taught (`f14af8f` · `0f95b53` · `76f72a2` · `5408beb` · `ee11998` · `d05501e` · `1ccbbf1`)
**Mode:** discovery only. Nothing implemented. Read-only commands only; `governance`, `student`, `prove`, `assess` **not run** (governance classes computed by calling the pure `classifyChange()` function).

---

## Executive conclusion

**The Lab has finished the cheap half of its curriculum and is now standing at the expensive one.**

Twelve instructional assets now teach 9 of 11 capabilities. That work is genuinely done. But the University's own learning model is **Incident → Principle → Practice → Proof**, and the coverage metric W3b added measures none of those beats — it measures whether instruction *exists*. Against the model the architecture actually declares:

```
Incident   20/20  ████████████████████  100%
Principle  13/20  █████████████·······   65%
Practice    5/20  █████···············   25%   (honest count: 2 — see §6)
Proof       0/20  ····················    0%   (hardcoded absent)
```

**Writing a tenth or eleventh lesson would move the number on the dashboard and nothing else.** The two remaining capabilities are Evidencing, both blocked at source, and filling them would require fabricating evidence the ROS explicitly refuses to release.

**The bottleneck has moved from teaching to practice.** And the engine is *not* the constraint: `reproductionTask()` already works, `cmds.lab` already renders a task, and for every practice-less unit the engine literally prints what is needed — *"a lab sharing at least 2 tags with content/failures/&lt;incident&gt;.mdx"*. It is waiting for documents nobody has written. **15 units are one lab away from teachable; five labs exist.**

**Recommended top action is therefore not a lesson.** It is authoring reproduction labs — but with the `findPractice` defect fixed first, because adding labs to a matcher that already produces two false positives out of five will multiply the error, not the coverage.

---

## 1. Current University state

```
competencies 6 · capabilities 11 · units 20
capabilities taught 9 · untaught 2 · mapped assets 12 · unknown 0
teachable 5 · missing principle 7 · missing practice 15 · students 0
curriculum_version 1.0.0 · approved_by "pending"
available lessons 57 · coming-soon 82 · declared 139 · routes 139
```

| Competency | Capabilities taught | Units (primary) | Units teaching |
|---|---|---|---|
| Foundations | **3/3** | 2 | 17 |
| Building | **1/1** | 1 | 3 |
| Integrating | **2/2** | 4 | 11 |
| Operating | **2/2** | 7 | 18 |
| Distributing | **1/1** | 2 | 5 |
| **Evidencing** | **0/2** | 1 | 2 |

Five of six competencies are fully taught. The sixth is blocked externally.

---

## 2. Current ROS state — re-read at source, not inherited

Read directly from `asquare-research/build/ros/status.json`:

```
file mtime : 2026-08-09 17:20:31
generated  : 2026-08-09T11:50:30+00:00
```

**Unchanged since W3. Nineteen days stale, and not because it is being ignored — because nothing has moved.**

| Study | Stage | Ver | Releasable | Open | Outstanding | Reproducibility |
|---|---|---|---|---|---|---|
| `denomination-2026-07` | correction | 1.0.0 | **false** | **COR-001** | 8 | **available — 189/189 checks, all gates green** |
| `ai-citations-2026-07` | published | 1.0.1 | **false** | **COR-003** | 20 | not available |
| `recovery-vs-verification-2026-07` | in_validation | null | **false** | none | 23 | not available |

**Corrections:**

- **COR-001** — `denomination-2026-07`, stage `version_decided`, **closed: null**. *"Headline 60.3% does not reproduce; three undocumented parser behaviours. Corrected value 55.9%."*
- **COR-002** — `ai-citations-2026-07`, stage **`closed`** 2026-08-07. *"All 89 dates malformed; no date parsed as ISO 8601."* Impact: *"None on findings."*
- **COR-003** — `ai-citations-2026-07`, stage `raised`, **closed: null**. *"v1.0.0 data files were not retained when v1.0.1 superseded them."*

**Verdict: no new evidence has become teachable since W4.** `denomination-2026-07` remains the closest — it has satisfied `numbers_trace`, `rowcount_n`, `limitations`, `confidence`, **`falsifier`**, `dictionary`, `citable`, `downloadable` and passes full reproducibility. Its eight remaining gates are `no_pii`, `third_party`, `seeds`, `nondeterminism`, `mirrored`, `doi`, `review`, `corrections_closed`. **It is blocked on publication governance and one open correction, not on method.**

---

## 3. The 20 units

`I` incident · `P` principle · `R` practice · `F` proof

| Unit | Competency | Beats | I P R F | Sev | Teachable |
|---|---|---|---|---|---|
| `firebase-deploy-sequence-auth-failure` | integrating | 3/4 | Y Y Y - | med | YES ⚠ |
| `gemini-json-parse-failure` | integrating | 3/4 | Y Y Y - | med | **YES ✅** |
| `wordpress-sitemap-404` | operating | 3/4 | Y Y Y - | high | YES ⚠ |
| `gemini-rate-limit-429-no-ux` | integrating | 2/4 | Y - Y - | med | YES ⚠ |
| `litespeed-client-cache-bypass-ignored` | distributing | 2/4 | Y - Y - | med | **YES ✅** |
| `claude-code-context-exhaustion` | **ambiguous** | 2/4 | Y Y - - | med | no |
| `edge-runtime-deployment-failure` | operating | 2/4 | Y Y - - | **high** | no |
| `environment-variable-missing-production` | operating | 2/4 | Y Y - - | **high** | no |
| `ga4-cross-domain-tracking-gap` | **evidencing** | 2/4 | Y Y - - | low | no |
| `gsc-index-coverage-drop` | distributing | 2/4 | Y Y - - | low | no |
| `next-mdx-remote-v6-blockjs` | **building** | 2/4 | Y Y - - | med | no |
| `razorpay-test-live-key-mismatch` | operating | 2/4 | Y Y - - | **high** | no |
| `server-module-client-bundle` | operating | 2/4 | Y Y - - | **high** | no |
| `wordpress-hfe-wpautop-injection` | **ambiguous** | 2/4 | Y Y - - | med | no |
| `wordpress-rest-api-auth-failure` | **ambiguous** | 2/4 | Y Y - - | med | no |
| `dns-subdomain-propagation-delay` | foundations | 1/4 | Y - - - | med | no |
| `firebase-auth-domain-not-authorized` | integrating | 1/4 | Y - - - | med | no |
| `firebase-functions-node-version-stability` | operating | 1/4 | Y - - - | **high** | no |
| `ga4-preview-environment-contamination` | foundations | 1/4 | Y - - - | low | no |
| `vite-github-pages-spa-routing` | operating | 1/4 | Y - - - | **high** | no |

**Highest-value incomplete units** — high severity, principle present, practice missing, and each already the subject of a live lesson:

1. `server-module-client-bundle` (high) — cited throughout the W2 post-mortem lesson
2. `edge-runtime-deployment-failure` (high) — cited in W4b
3. `environment-variable-missing-production` (high) — the motivating incident for W4b
4. `razorpay-test-live-key-mismatch` (high)
5. `vite-github-pages-spa-routing` (high) — 1/4, missing both Principle and Practice

**Five units are 1/4** and need both beats. Three are permanently `ambiguous` — the classifier reports rather than guesses, which is correct behaviour but leaves them uncounted in any competency.

---

## 4. The 11 capabilities against actual assets

| Capability | Competency | A. Teach | B. Practice | C. Principle | D. Proof | E. Missing | F. Category |
|---|---|---|---|---|---|---|---|
| `deploy-and-read-logs` | foundations | ✅ ×3 | 4/17 units | 10/17 | ✗ | practice + proof | **lab/practice** |
| `version-control-recovery` | foundations | ✅ | 4/17 | 10/17 | ✗ | practice + proof | **lab/practice** |
| `env-separation` | foundations | ✅ | 4/17 | 10/17 | ✗ | practice + proof | **lab/practice** |
| `ship-a-user-surface` | building | ✅ | **0/3** | 2/3 | ✗ | **no practice at all** | **lab/practice** |
| `handle-every-api-branch` | integrating | ✅ | 3/11 | 6/11 | ✗ | practice + proof | **lab/practice** |
| `structured-output-contract` | integrating | ✅ | 3/11 | 6/11 | ✗ | practice + proof | **lab/practice** |
| `detect-production-break` | operating | ✅ | 3/18 | 11/18 | ✗ | practice + proof | **lab/practice** |
| `write-a-postmortem` | operating | ✅ | 3/18 | 11/18 | ✗ | practice + proof | **lab/practice** |
| `measure-findability` | distributing | ✅ ×2 | 2/5 | 4/5 | ✗ | practice + proof | **lab/practice** |
| `claim-with-dataset` | evidencing | ✗ | **0/2** | 1/2 | ✗ | teaching + everything | **research dependency — BLOCKED** |
| `falsifiable-claim` | evidencing | ✗ | **0/2** | 1/2 | ✗ | teaching + everything | **research dependency — BLOCKED** |

**Nine of eleven capabilities have the same missing piece: practice, then proof.** Not one is short of teaching. `ship-a-user-surface` is the starkest — Building has **zero** units with a practice beat.

Two capabilities carry `derived_from_incident` (`handle-every-api-branch` ← `gemini-rate-limit-429-no-ux`; `structured-output-contract` ← `gemini-json-parse-failure`) and two carry `governed_by: RESEARCH_STANDARD.md` — the two blocked ones.

---

## 5. The 9/11 → 11/11 trap

**Recommendation: wait. Do not write either Evidencing lesson.**

The repository does not contain evidence that can responsibly teach these two capabilities today:

- `claim-with-dataset` requires *"a claim, its dataset, its sample size and at least one limitation"* — and **all three studies are `releasable: false`.**
- `falsifiable-claim` requires *"the observation that would falsify it"*. The Lab's single best artefact is **COR-001** — a published headline that failed to reproduce, caught by internal audit, with the honest note that *"both original defects biased toward the published claim."* It is **still open** (`stage: version_decided`, `closed: null`). Teaching from it now means teaching a number under correction, which the engine's own rule forbids: *"teaching a number under correction propagates the defect."*

There is a narrower option worth naming but **not** recommending yet: teaching the *method* — how the ROS gates work, what `falsifier` and `limitations` mean, why `releasable: false` matters — using **COR-002**, which is fully closed with *"None on findings."* That would be defensible. It would also be a lesson about process rather than about a claim, and it would half-satisfy a capability whose proof task demands a real dataset. **Better to wait for COR-001 to close and get the real thing.**

**Filling these two to reach 11/11 would be the single most damaging thing the Lab could do to its own credibility**, because the standard it would violate is the one it teaches in W2 and W4c.

---

## 6. The practice / proof bottleneck

**Verified current state:** teachable 5 · missing principle 7 · missing practice 15 · proof 0/20.

### The proof beat is not a gap — it is a design decision

`curriculum.mjs:139` hardcodes `proof: { source: null, present: false, produced_by: 'project engine' }` for every unit. `complete` is therefore capped at **3/4 permanently**. Proof is a *student artefact*, produced by a project engine that does not exist. **No amount of authoring changes this.** Any target expressed as "units at 4/4" is unreachable by construction.

### The practice beat is a gap, and the engine is ready for it

`reproductionTask()` (`assessment.mjs:130`) already works. Run against a unit without practice it returns:

```
unavailable: no reproduction lab matches this incident
needed: a lab sharing at least 2 tags with content/failures/server-module-client-bundle.mdx
```

**The engine is telling you exactly what to write.** Against a unit with practice it renders a five-step task. Those steps are *generic* — identical for every unit — so the unit-specific value comes entirely from the lab document, not from the engine.

**Conclusion: the constraint is authored labs, not engineering.** Five labs exist; 15 units want one.

### But the matcher is wrong first

`findPractice()` is a flat `overlap >= 2` against a tag vocabulary containing high-frequency platform tags. Of the five current matches:

| Unit | Lab | Overlap | Shared tags | Genuine |
|---|---|---|---|---|
| `gemini-json-parse-failure` | gemini reliability | 6 | gemini, json, structured-output, firebase-functions, scamcheck, trustseal | ✅ |
| `litespeed-client-cache-bypass-ignored` | litespeed UCSS | 2 | litespeed, wordpress | ✅ |
| `gemini-rate-limit-429-no-ux` | gemini reliability | 3 | gemini, firebase-functions, scamcheck | ⚠ weak |
| `firebase-deploy-sequence-auth-failure` | **gemini reliability** | 2 | firebase-functions, trustseal | ❌ |
| `wordpress-sitemap-404` | wp rollout evidence | 2 | wordpress, seo | ❌ |

**Honest teachable count: 2.** Tag frequency among the 15 practice-less incidents shows why this will get worse: `deployment` ×5, `vercel` ×5, `next.js` ×3, `firebase` ×3, `authentication` ×3, `configuration` ×3. **A new lab tagged `deployment, vercel` would immediately and wrongly attach to five unrelated incidents.**

This is why the matcher must be fixed *before* labs are written, not after.

---

## 7. Integrity debt

| # | Item | Verified now | Class |
|---|---|---|---|
| 1 | `findPractice()` false positives — 2 of 5 matches are tag collisions | confirmed | **HIGH — blocking §6** |
| 2 | `approved_by: "pending"` — no certificate may be issued | confirmed | **HIGH — founder-only, blocks all certification** |
| 3 | Soft-404: unknown lesson id returns **HTTP 200** with a 38 KB shell; root 404 works | confirmed live | **MEDIUM** |
| 4 | 7 units missing Principle; 3 have a candidate doc already present (`github-pages-spa-deployment`, `gemini-production-operations`, `analytics-setup`) | confirmed | **MEDIUM — cheapest curriculum win** |
| 5 | 3 units permanently `ambiguous` — uncounted in any competency | confirmed | **MEDIUM** |
| 6 | 6 `eval/*.test.mjs` pinned to the dead `C:/Users/Acer/Desktop/ai-execution-lab` path | confirmed | **MEDIUM — one line each** |
| 7 | 4 untracked audit reports (W3b, W4, W4b, W4c) | confirmed | **LOW** |
| 8 | `ComSpec=C:\ffmpeg` breaks `npm run` | confirmed | **LOW — user's machine, not the repo** |
| 9 | Phantom `/search` in JSON-LD | **`/search` now returns 404** — schema still advertises it | **LOW** |
| 10 | Proof beat hardcoded absent | confirmed | **INTENTIONAL / DEFERRED** |
| 11 | 82 `coming-soon` lessons; 5 hollow tracks; D-008 open | confirmed | **INTENTIONAL / DEFERRED** |

---

## 8. Is the engine now the bottleneck?

**No — with one exception.** What the code actually supports today:

| Layer | Implemented | Usable now |
|---|---|---|
| Corpus reading | ✅ `corpus.mjs`, incl. `lessonCapabilities` (W3b) | yes |
| Classification | ✅ weighted, multi-label, ambiguity reported | yes |
| Principle join | ✅ `related_docs` slug lookup | yes — **7 units simply lack the link** |
| **Practice join** | ⚠ `findPractice()` flat ≥2 overlap | **yes but wrong — §6** |
| Proof join | ✗ hardcoded absent | no — needs a project engine |
| Teaching coverage | ✅ `capabilityCoverage()` (W3b) | yes |
| **Teaching → practice join** | ✗ **does not exist** | no |
| Reproduction task | ✅ `reproductionTask()` + `cmds.lab` | yes — generic steps |
| Assessment | ✅ `assess()` against the rubric | yes, but no submissions |
| Certification | ✅ `evaluateCertification()` | **blocked by `approved_by: pending`** |
| Graduation | ✅ `evaluateGraduation()` | blocked, `students: 0` |
| Student state | ✅ `progress.mjs` | **no `state/` directory; 0 students** |
| Student-facing UI | ✗ nothing in `app/` or `components/` imports `lib/university` | **no** |

**The one genuine architectural gap is the teaching → practice join.** A lesson declares `proves: [capability]`; a lab attaches to an *incident* by tags. Nothing connects "the lesson that teaches X" to "the lab where you practise X". That is the natural successor to W3b — but it is only worth building once labs exist to join.

**The engine is not the constraint. Authored labs are.**

---

## 9. Governance classification

Computed via `classifyChange()` — not guessed:

| Action | Class | Version | Requires |
|---|---|---|---|
| Write a new lab (`content/labs/*.mdx`) | **none** | 1.0.0 | — |
| Add a new lesson + `proves` mapping | **none** | 1.0.0 | — |
| Add `related_docs` to a failure doc | **patch** | 1.0.1 | curriculum_owner_approval |
| Change the `findPractice` matching rule | **patch** | 1.0.1 | curriculum_owner_approval |
| Add a new capability | **minor** | 1.1.0 | curriculum_owner_approval |
| Add a new failure doc (= new unit) | **minor** | 1.1.0 | curriculum_owner_approval |
| Change the rubric | **major** | 2.0.0 | **founder_approval** |
| Change graduation requirements | **major** | 2.0.0 | **founder_approval** |

**One caveat, stated plainly:** `classifyChange()` returns **patch** for a `findPractice` change, because its only matching input is `corrected`. But that change alters what `teachable` *means* across all 20 units. The classifier under-classifies it. I would treat it as patch-with-notice and record the before/after counts, rather than argue the classifier is wrong.

---

## 10. Top 3 recommended actions

### W5a — Fix `findPractice`, then record the honest number · **P0**

**Category:** curriculum-engine integrity · **Governance:** patch · **New content:** none

The matcher produces 2 false positives out of 5, and tag frequency guarantees more as labs are added. Candidate remedies, in order of fit with the existing architecture:

1. **A `reproduces:` frontmatter key on labs**, naming the incident slug explicitly — mirrors exactly how `related_docs` already drives the Principle beat. Deterministic, auditable, no scoring.
2. Raise the threshold and/or weight tags by inverse document frequency — cheaper, still heuristic.
3. Exclude a declared set of platform/product tags from the overlap.

**Recommend option 1.** It makes Practice as explicit as Principle and removes guessing from the one beat a student actually performs.

Expected effect: `teachable` falls from 5 to 2–3 and becomes true. **That is a metric going down and the Lab getting more honest** — which is the same move the W4c lesson teaches.

**Do first**, because everything in W5b depends on the matcher being trustworthy.

---

### W5b — Author reproduction labs for the high-severity units · **P0/P1**

**Category:** lab / practice · **Governance:** none · **New content:** 2–3 labs

Target, in order — all high severity, all with Principle already present, all already cited by a live lesson:

1. `server-module-client-bundle` — the transitive client-import boundary; the incident that created `lib/lesson-content.ts`
2. `edge-runtime-deployment-failure` — cited in W4b's deploy-gate section
3. `environment-variable-missing-production` — *"Found after user testing in production"*, the motivating incident for W4b

Each is deliberately reproducible on a student's own project, each has a documented fix, and each would take its unit from 2/4 to 3/4 — **the ceiling**.

Write **2–3, not 15.** The goal is a proven lab format, not coverage.

---

### W5c — Link the 3 available Principle docs · **P1**

**Category:** maintenance / integrity · **Governance:** patch · **New content:** none — frontmatter only

Three of the seven Principle-less units have a candidate doc already in `content/docs`:

| Unit | Candidate |
|---|---|
| `vite-github-pages-spa-routing` | `github-pages-spa-deployment.mdx` |
| `gemini-rate-limit-429-no-ux` | `gemini-production-operations.mdx` |
| `ga4-preview-environment-contamination` | `analytics-setup.mdx` |

`missing_principle` would move **7 → 4** for zero words written. Each link must be verified as genuinely the principle for that incident, not merely topically adjacent — that check is the actual work.

**This is the cheapest true win available**, and it is the one carried forward unactioned since W3.

---

## 11. Dependencies

```
W5a (fix findPractice)  ──> W5b (author labs)
                        └─> honest teachable count

W5c (related_docs)      ──  independent, can run in parallel

Evidencing capabilities ──> BLOCKED on COR-001 closing (ROS, not us)
Certification           ──> BLOCKED on approved_by (founder, not us)
Proof beat              ──> BLOCKED on a project engine (does not exist)
Teaching→practice join  ──> depends on W5b producing labs first
```

---

## 12. Do NOT do yet

1. **Do not write `claim-with-dataset` or `falsifiable-claim` lessons.** §5. Both blocked at source.
2. **Do not chase 11/11.** The number is not the goal; two openly blocked capabilities are the honest state.
3. **Do not author labs before fixing `findPractice`.** New labs will mis-attach; `deployment` and `vercel` each appear on five practice-less incidents.
4. **Do not "fix" `teachable` by redefining it.** Fix the matcher; let the number fall.
5. **Do not build the certification UI.** `approved_by: "pending"`, `students: 0`.
6. **Do not build a project engine for the Proof beat.** Large, and premature with no students.
7. **Do not fill the 82 `coming-soon` slots or the 5 hollow tracks.** D-008 remains open.
8. **Do not touch the ROS.** Frozen; the engine only reads it.
9. **Do not batch the soft-404, eval paths or ComSpec into curriculum work** — real, but separate.

---

## 13. Recommended W5 execution order

| | Action | Class | Content | Effect |
|---|---|---|---|---|
| **1** | **W5a** — `findPractice` correction | patch | none | `teachable` becomes true (5 → ~2) |
| **2** | **W5c** — 3 `related_docs` links | patch | none | `missing_principle` 7 → 4 |
| **3** | **W5b** — 2–3 reproduction labs | none | 2–3 labs | practice-less units 15 → 12–13; first units genuinely at 3/4 |
| — | **Re-audit.** Then consider the teaching→practice join. | | | |

**Note what is absent from this list: a new lesson.** For the first time in this programme, the highest-value work is not instruction. Teaching is 9/11 and the two remaining are blocked. Practice is 2/20 honestly counted, and that is where a student's competence is actually demonstrated.

The Lab has spent W1–W4 building what it says. W5 is where it starts building what it *asks students to do* — and the first step is admitting the practice number is 2, not 5.

---

## 14. Working-tree integrity

```
HEAD                : 1ccbbf112ac0fa201597ad24eecd1b3c841f7cf7   sync 0/0   staged 0
lib/university      : 15 files, byte-identical before and after
lib/tracks.ts       : unchanged      content/lessons : unchanged
content/labs        : unchanged      content/failures : unchanged
state/ directory    : absent — no student state created
mutating commands   : governance/student/prove/assess NOT run
working tree        : 125 entries before; only this report added
```
