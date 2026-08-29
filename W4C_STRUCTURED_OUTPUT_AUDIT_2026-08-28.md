# W4c — Structured Output Contract Audit

**Date:** 2026-08-28 · **HEAD:** `d05501e2df80f49e4bd28472fa7156df4143ba2a`
**Target capability:** `structured-output-contract` · **Competency:** Integrating
**Mode:** discovery only. Nothing implemented, modified, staged, committed, pushed or deployed. Read-only commands only; `governance`, `student`, `prove`, `assess` **not run** (governance class computed by calling the pure `classifyChange()` function).

---

## 1. Executive verdict

**Yes, the capability is unblocked, and yes, one lesson is enough — but this case differs from W4a and W4b in two ways that need a decision from you.**

**First: the evidence is the strongest in the corpus, and it is already fully consumed.** `gemini-json-parse-failure` is the **only unit in all 20 that reaches 3/4 beats with every available beat filled** — Incident, Principle *and* Practice all present. The lab that supplies its Practice beat is the same document that would ground this lesson. That is not a conflict, but it must be handled carefully: **the lab should stay Practice and must not receive `proves`.** See §6.

**Second: no existing `coming-soon` slot fits.** W4a and W4b each filled a declared promise. Here the only thematically correct home is the `model-integration` module W1 created, which has no empty slot — so W4c would **add** a lesson entry rather than consume one. The alternative, `testing-ai-code`, is about testing AI-*generated code*, not model *output contracts*; mapping it would be the kind of stretch the W3 audit explicitly warned against.

**Third, and this corrects the brief:** the lab records **four** prompt iterations, not three. The `~4%` figure is iteration **1**, not iteration 2. Full reconstruction in §5.

---

## 2. Capability definition

```json
{
  "id": "structured-output-contract",
  "competency": "integrating",
  "statement": "You can make a language model return output your parser accepts, and prove the failure rate fell.",
  "proof_task": "Show a before/after parse-failure rate with the prompt change that caused it.",
  "proof_artifact": "measurement + prompt diff",
  "derived_from_incident": "gemini-json-parse-failure"
}
```

**Competency:** Integrating — *"Can call a model or a paid API from production and handle every branch it can return, not only the happy one."* `requires: ["foundations"]`, which is **3/3 taught**. Integrating holds two capabilities: `handle-every-api-branch` (taught by W1) and `structured-output-contract` (untaught).

**The statement has two halves, and the second is the whole difficulty:**

- *"make a language model return output your parser accepts"* — technique
- *"**and prove the failure rate fell**"* — measurement

The proof task reinforces it: a **before/after rate**, plus **the prompt change that caused it**. An artefact with a prompt diff and no number does not satisfy it; nor does a number with no diff.

---

## 3. Existing slot analysis

**There is no `structured-output-contract` slot.** Every `coming-soon` entry matching output/validation/schema/testing keywords was examined:

| Candidate | Type | Duration | Track / module | Verdict |
|---|---|---|---|---|
| `testing-ai-code` | lesson | 25 min | operator / product-development | ❌ *"Validation patterns for code you didn't write but are responsible for"* — testing **generated code**, not **model output contracts**. Different subject. |
| `ship-velocity-quality` | lesson | 20 min | operator / product-development | ❌ unrelated |
| `assertion-patterns` | lab | 40 min | ai-automation-systems / quality-monitoring | ❌ hollow track (0 built lessons) |
| `quality-control` | lesson | 25 min | ai-content-distribution | ❌ hollow track; content QC, not model output |
| `rate-limiting` | lesson | 20 min | ai-automation-systems | ❌ hollow track; and rate limits are W1's subject |
| `testing-framework` | lab | 45 min | geo-ai-search / measurement | ❌ GEO measurement |

**The thematically correct home is `claude-code-operator/model-integration`** — created in W1, described as *"Call a model API from production and handle every branch it can return, not only the happy one."* It currently holds one lesson (`connect-gemini-api`, available, 25 min) and sits at position 6 of 9 in the track.

**This is the trade-off:** W4a and W4b each reduced the `coming-soon` count by filling a promise. W4c would leave it unchanged and add an entry — total declared lessons 138 → 139, available 56 → 57. It adds no hollow promise (the entry ships `available`), but it does grow the board. Options in §11.

---

## 4. Existing Gemini / structured-output evidence

| Asset | Words | Type | Role |
|---|---|---|---|
| `content/labs/gemini-structured-output-reliability.mdx` | 1,290 | **lab** | The experiment. Currently the **Practice beat** for `gemini-json-parse-failure`, matched at tag-overlap 6 |
| `content/failures/gemini-json-parse-failure.mdx` | 1,380 | failure | The **Incident beat**; the capability's `derived_from_incident` |
| `content/docs/ai-output-structure-validation.mdx` | 1,706 | doc | The **Principle beat**, linked via `related_docs` |
| `content/docs/gemini-production-operations.mdx` | 1,958 | doc | §Structured Output Enforcement, §Three-Part Prompt Architecture |
| `content/lessons/.../connect-gemini-api.mdx` (W1) | 1,114 | **lesson** | The only instruction; covers handling, not measurement |
| `content/case-studies/scamcheck-architecture-build.mdx` | 2,914 | case study | The three-part prompt as a build decision |

**Unit state, verified this session** — the most complete unit in the corpus:

```
gemini-json-parse-failure     competency: integrating
  [OK  ] incident   content/failures/gemini-json-parse-failure.mdx
  [OK  ] principle  content/docs/ai-output-structure-validation.mdx
  [OK  ] practice   content/labs/gemini-structured-output-reliability.mdx
  [FAIL] proof      project engine        ← hardcoded absent for every unit
```

---

## 5. Experiment reconstruction — read from source, correcting the brief

The lab's frontmatter carries `result: "confirmed"` and a hypothesis in **If / Then / Because** form.

**Setup.** Gemini 1.5-flash, called from Firebase Cloud Functions, during ScamCheck and TrustSeal development, February 2026. `LessonMeta` states the evidence as *"Production data from ScamCheck and TrustSeal Cloud Functions — real user inputs, real Gemini responses logged."* Implementation time 2h.

**Measured signal.** *"SyntaxError events on `JSON.parse()` in the Cloud Function logs."* A single, unambiguous, log-derived definition of failure.

**Failure definition.** Output that `JSON.parse()` rejects. The lab decomposes the baseline into three observed behaviours: clean JSON, markdown-fence wrapping, explanation prefix/suffix.

**Four iterations — not three:**

| # | Prompt approach | Clean | Fenced | Prefixed | **Parse failure** |
|---|---|---|---|---|---|
| **0** | Minimal — *"Return a JSON response"* | ~94% | ~4% | ~2% | **~6%** |
| **1** | Schema described **in prose** (field list) | ~96% | ~3% | ~1% | **~4%** |
| **2** | **Exact JSON shape embedded**, no suppression | ~98% | ~1.5% | ~0.5% | **~2%** |
| **3** | Schema **+ explicit format suppression** (production) | ~99.2% | ~0.6% | ~0.2% | **~0.8%** |
| 3+ | Iteration 3 **+ pre-parse cleaning layer** | — | — | — | **~0%** |

**What changed between iterations** — the lab's own attributions:

- 0→1: prose schema. *"Marginal improvement — the prose description of the schema did not eliminate decorated output."*
- 1→2: literal JSON template. *"Substantial improvement from embedding the literal schema shape. The model mapped its output directly to the provided template."*
- 2→3: *"Do not wrap it in code fences. Do not add any text before or after the JSON."* — *"not redundant — it measurably reduces the residual failure rate beyond what schema embedding alone achieves."*
- 3→3+: a `cleanGeminiOutput()` function that strips fences and slices from the first `{` to the last `}`.

**Conclusion the lab draws:** *"Two-layer defense is the production pattern: tight prompt constraints (reduce failure frequency) + pre-parse cleaning (handle residual failures). Neither layer alone is sufficient."*

### Limitations the lab does not state — and a lesson must

These are read from the source, not speculated:

1. **No sample size anywhere.** Every rate is prefixed `~`. No n, no rowcount, no denominator. The ROS gates `rowcount_n` and `numbers_trace` would not pass on this document.
2. **No limitations section.** Unlike the ROS studies, the lab states none.
3. **Iteration 3 changed more than one variable.** Its prompt added format suppression **and** a 12-value signal taxonomy **and** three edge-case instructions. Attributing the 2%→0.8% move to suppression alone is not a clean single-variable inference. The lab asserts it; the design does not isolate it.
4. **Single model, single family.** Gemini 1.5-flash only.
5. **Two products, one domain.** ScamCheck and TrustSeal, both scam/trust classification.
6. **Windows differ.** Iterations 0–2 are dated February 2026; iteration 3 cites *"production data, February–May 2026"* — a longer and later window, so the comparison is not strictly like-for-like.
7. **`~0%` is "0 parse failures across all logged production inputs"** — a count of zero over an unstated denominator, not a measured rate.

### A documentation inconsistency worth resolving

The lab and the failure doc credit the same 6% baseline to **different interventions**:

- Lab: prompt iteration takes 6% → 0.8%; cleaning then takes 0.8% → 0%.
- `gemini-json-parse-failure` §Failure Frequency: *"**Before pre-parse cleaning was implemented**, ~6% of all analysis requests resulted in a failed response. After cleaning, the parse success rate on real inputs reached 100%."*

Both cite the same ~94/~4/~2 baseline split. The lab is the finer-grained account. **A lesson should cite the lab and note the coarser framing, not silently pick one.**

---

## 6. Evidence → capability mapping

| Capability requirement | Supported? | Source |
|---|---|---|
| model output → expected structure | ✅ | lab iterations 2–3; `gemini-production-operations` §Structured Output Enforcement |
| validation / parsing boundary | ✅ | `cleanGeminiOutput()` in the lab; `ai-output-structure-validation` §The Architecture That Makes It Robust |
| malformed-output detection | ✅ | `SyntaxError` on `JSON.parse()`, logged |
| failure handling | ✅ | pre-parse cleaning; `gemini-json-parse-failure` §Cloud Function Error Handling, §Client-Side Handling |
| **measurable verification** | ✅ | **the four-iteration rate table — the strongest asset here** |
| **before/after + prompt diff** | ✅ | four prompts quoted in full, each with its rate |

**Every element of the proof task is supported by a real document.**

### Should the lab remain Practice rather than receive `proves`?

**Yes — unambiguously, and for three independent reasons:**

1. **Mechanical.** `proves` is a field on `Lesson` entries in `lib/tracks.ts`. The lab has no track entry (`grep` → 0 mentions). It could not receive `proves` without being made a track entry, which it is not.
2. **Structural.** `rules.json → beat_sources.practice.folder = "content/labs"`. This lab is the matched Practice beat for `gemini-json-parse-failure` at tag-overlap 6 — the single strongest and least disputable practice match in the corpus (§6 of the W3 audit found two of the five to be tag collisions; this is not one of them). Moving it into the teaching layer would degrade the one unit that is fully assembled.
3. **Semantic.** The three layers must stay separate: **lesson = teaches · lab = student reproduction · proof = student artefact.** The lab is A Square's own experiment, not a student task. A lesson may *cite* it as worked evidence; it must not *become* it.

---

## 7. Distinction from `connect-gemini-api` (W1)

W1's sections: *What this lesson covers · Why the happy path is a trap · Failure 1 — Gemini does not always return the JSON you asked for · Failure 2 — 429 is not an edge case · The pattern, generalised · Verify against failure, not success · What this cost us.*

| | `connect-gemini-api` (W1) | W4c |
|---|---|---|
| Capability | `handle-every-api-branch` | `structured-output-contract` |
| Question | *What can this API return, and do I handle each branch?* | *Can I make the output parseable, and prove it got better?* |
| Scope | JSON **and** 429 — two failure classes | JSON structure only |
| Verb | **handle** | **reduce, then measure** |
| Contains a rate? | **No** — a grep for rate/measurement language returns prose about rate *limits*, no parse-failure percentage | The four-iteration table is the centre |
| Prompt engineering | absent | the four prompts, diffed |

W1 says *"never ship an interface that can spin forever."* W4c says *"show me the number before and the number after, and the prompt line that moved it."* **They share a failure and share nothing else.** W4c should cite W1 for the handling layer rather than restate it.

---

## 8. Existing instructional overlap

| Asset | Overlaps on | Boundary |
|---|---|---|
| `connect-gemini-api` (lesson) | the same two failures | handles branches; no measurement — see §7 |
| `ai-output-structure-validation` (doc) | §Testing AI Output Parsing — **golden output tests, adversarial inputs, fault injection** | **Closest overlap in the repository.** It teaches *testing a parser*; W4c teaches *measuring a rate and attributing the change*. Related but not the same. A doc, not instruction. |
| `gemini-production-operations` (doc) | §Structured Output Enforcement, §Three-Part Prompt Architecture | doctrine, not instruction |
| `gemini-json-parse-failure` (failure) | §Prompt Constraints That Reduce Frequency | the incident record; the lesson's Incident, not its substance |
| `post-mortem-process` (W2) | evidence vs assumption, stating unknowns | the discipline; W4c applies it to a measurement |
| `debugging-methodology` | *"verifying fixes correctly"* | verifying one fix ≠ measuring a rate across a population |

**The uncovered space:** treating a prompt as a change with a measurable effect, and proving the effect — including stating the denominator and what the experiment did not isolate.

---

## 9. What a new lesson should teach

1. A structured-output contract is a *contract* — what the parser will accept, stated before the prompt is written
2. Why models decorate by default, and that it is a property, not a bug (`gemini-json-parse-failure` §Why This Happens)
3. Defining failure as an observable event: `SyntaxError` on `JSON.parse()` in a log you can count
4. Establishing a baseline before changing anything — the discipline the lab followed
5. Iterating one prompt change at a time, and reading marginal results honestly (0→1 was "marginal")
6. Prose schema < literal schema < literal schema + explicit suppression, with the four real rates
7. **The two-layer defence:** prompt constraint reduces frequency, pre-parse cleaning handles the residue; neither alone suffices
8. **Measuring the change, and stating what the measurement cannot support** — no n, one model, one domain, and iteration 3 changing three things at once
9. The proof artefact: a before/after rate **plus** the prompt diff

Item 8 is what distinguishes this from a prompt-engineering tip sheet, and it is where the lesson can honestly exceed its own source.

---

## 10. What must NOT be claimed

- **No sample size, denominator, confidence interval, or significance claim.** None exists.
- **Do not present the rates as precise.** They are `~` throughout; say so.
- **Do not claim iteration 3 isolates format suppression.** Its prompt changed three things.
- **Do not treat `~0%` as a measured rate.** It is zero failures over an unstated denominator.
- **Do not generalise beyond Gemini 1.5-flash** or beyond ScamCheck/TrustSeal.
- **Do not silently reconcile** the lab and the failure doc; cite the lab, note the difference.
- **No new experiment, iteration, prompt or number.**
- **No customer, revenue, or incident not already recorded.**

---

## 11. Options — decision required

| | **Option A — recommended** | Option B | Option C |
|---|---|---|---|
| Home | new entry in `claude-code-operator/model-integration` | fill `testing-ai-code`, amend metadata | do not implement |
| Slot metadata | none amended | title + description rewritten | — |
| Declared lessons | 138 → **139** | 138 (promise consumed) | unchanged |
| coming-soon | 82 (unchanged) | 82 → 81 | 82 |
| Pro | thematically exact; sits beside W1; no misleading metadata | reduces promise debt | zero change |
| Con | **adds an entry rather than filling one** | **subject genuinely differs** — testing generated code ≠ model output contract; the W3 audit warned against exactly this stretch | capability stays untaught at 8/11 |
| Governance | `none` | `patch` (metadata correction) | — |

**Recommended: Option A.** The module W1 created exists precisely for model-API integration and currently holds one lesson; a second on the output contract is its natural companion. Option B would consume a promise but at the cost of describing the lesson inaccurately — the same failure mode W4b's Option A was chosen to avoid, in reverse.

---

## 12. Proposed minimal implementation

**Two files.** New `content/lessons/claude-code-operator/model-integration/structured-output-contract.mdx` (~1,700–1,900 words, house format), and one new `Lesson` entry in `lib/tracks.ts` under `model-integration`, shipping `status: 'available'` with `proves: ['structured-output-contract']`.

Nothing in `lib/university/`. No capability, unit, rubric, certification or governance change. The lab stays exactly where it is.

**Governance, computed this session:**

```
add one lesson             → { class: 'none' }
map lesson → existing cap  → { class: 'none' }
slot metadata correction   → { class: 'patch', requires: ['curriculum_owner_approval'] }
```

Option A involves no metadata correction, so **class `none`**.

---

## 13. Expected coverage change

| | Before | After |
|---|---|---|
| capabilities taught | 8 of 11 | **9 of 11** |
| untaught | 3 | **2 — `claim-with-dataset`, `falsifiable-claim`** |
| mapped assets | 11 | **12** |
| **Integrating** | 1 of 2 | **2 of 2 — complete** |
| available / coming-soon | 56 / 82 | 57 / 82 (Option A) |

**Integrating would become the second fully-taught competency**, after Operating. Foundations would be the only remaining partially-taught one at 3/3 capabilities but with all three operator-gated.

The two remaining untaught capabilities are both Evidencing and both blocked by the ROS: COR-001 and COR-003 open, all three studies `releasable: false`. **They must not be fabricated around.**

Unchanged: competencies 6 · capabilities 11 · units 20 · teachable 5 · missing principle 7 · missing practice 15 · students 0 · unknown 0.

---

## 14. Verification gates

`tsc --noEmit` · scam-intel 30/30 · six University read-only commands exit 0 · **`curriculum` and `unit` output byte-identical** (the lab is not touched, so `gemini-json-parse-failure` must still read 3/4 with Practice present) · `next build` passes · route resolves, `Coming Soon` = 0 · `proves` resolves, unknown = 0 · taught 8 → 9, untaught 3 → 2, mapped 11 → 12 · invariants unchanged · `lib/university` byte-identical · no `state/` · tree delta exactly 2 paths · existing 11 mappings undrifted · `content/labs/` untouched.

---

## 15. Working-tree integrity

```
HEAD                : d05501e2df80f49e4bd28472fa7156df4143ba2a   sync 0/0   staged 0
lib/university      : 15 files, byte-identical before and after
lib/tracks.ts       : unchanged        content/lessons : unchanged
content/labs        : unchanged
state/ directory    : absent — no student state created
mutating commands   : governance/student/prove/assess NOT run
working tree        : 124 entries before; only this report added
```

---

## Answers to the required questions

**Is `structured-output-contract` genuinely unblocked?** Yes. Foundations 3/3; no dependency; every element of the proof task has a documented source.

**Is there enough evidence for one lesson?** Yes, comfortably — four quoted prompts, four measured rates, a cleaning implementation, and an incident record.

**Is `gemini-structured-output-reliability.mdx` strong enough as the source?** Yes, with caveats that improve the lesson: no sample size, no limitations section, and iteration 3 changed three variables at once. Teaching those gaps honestly is better pedagogy than hiding them.

**What should the lesson teach that `connect-gemini-api` does not?** Measurement and attribution — baseline, single-variable iteration, before/after rate, prompt diff, and what the number cannot support. W1 teaches handling; this teaches proving.

**Should the lab remain Practice?** **Yes.** It has no track entry, it is the corpus's strongest Practice match, and blurring lesson/lab/proof would degrade the only fully-assembled unit.

**Which slot is the correct home?** None exactly. `claude-code-operator/model-integration` is thematically correct but has no empty slot — Option A adds an entry. `testing-ai-code` is the only real alternative and is a different subject.

**Is slot metadata correction necessary?** Not under Option A. Only under Option B, which would be `patch`.

**Supported vs inferred?** Supported: all four rates, all four prompts, the cleaning function, the two-layer conclusion, the incident. Inferred: that iteration 3's gain came from suppression alone (the lab asserts it; the design does not isolate it) — the lesson should present this as the lab's claim, not as established.

**Would one lesson be sufficient?** Yes. One, ~1,700–1,900 words.

**Would coverage become 9/11?** Yes — 9 taught, 2 untaught, both Evidencing and both ROS-blocked.
