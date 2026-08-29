# W4 — Gap Prioritisation Audit

**Date:** 2026-08-28 · **HEAD:** `5408beb7d2a73f21931442e80e7a61f013bb53eb`
**Preceding:** W1 `f14af8f` · W2 `0f95b53` · W3 `76f72a2` · W3 audit `54e9395` · W3b `5408beb`
**Mode:** discovery only. Nothing implemented. Read-only commands only (`status`, `gaps`, `curriculum`, `graph`, `research`, `unit`). `governance`, `student`, `prove`, `assess` **not run**.

---

# 1. VERIFIED FACTS

Every statement in this section was read from a file or produced by a read-only command during this audit.

## 1.1 Engine state

```
competencies 6 · capabilities 11 · units 20
capabilities taught 6 · untaught 5 · mapped assets 9 · unknown 0
teachable 5 · missing principle 7 · missing practice 15 · students 0
curriculum_version 1.0.0 (APPROVAL PENDING)
```

## 1.2 Capability dependency structure — the decisive finding

Computed from `competencies.json` + `capabilities.json` against the six currently-taught capabilities:

| Untaught capability | Competency | Competency requires | Prerequisite coverage |
|---|---|---|---|
| `ship-a-user-surface` | building | foundations | **foundations 3/3 taught** |
| `structured-output-contract` | integrating | foundations | **foundations 3/3 taught** |
| `detect-production-break` | operating | foundations | **foundations 3/3 taught** |
| `claim-with-dataset` | evidencing | building, integrating, operating | **building 0/1**, integrating 1/2, operating 1/2 |
| `falsifiable-claim` | evidencing | building, integrating, operating | **building 0/1**, integrating 1/2, operating 1/2 |

**`ship-a-user-surface` is Building's only capability.** Building is a declared prerequisite of both Evidencing and Distributing. While it has no teaching asset, Building has **zero taught capabilities**, and the two competencies above it rest on an entirely untaught prerequisite.

## 1.3 Research pipeline — verified at source, not assumed

Read directly from `asquare-research/build/ros/status.json` (generated `2026-08-09T11:50:30+00:00`), not only from the engine:

| Study | Stage | Releasable | Open corrections | Outstanding gates | Reproducibility |
|---|---|---|---|---|---|
| `denomination-2026-07` | correction | **false** | **COR-001** | 8 | **available: 189/189 checks passed — all gates green** |
| `ai-citations-2026-07` | published | **false** | **COR-003** | 20 | not available |
| `recovery-vs-verification-2026-07` | in_validation | **false** | none | 23 | not available |

**The W3 finding still holds: 0 of 3 teachable.** The ROS status file is 19 days old and unchanged.

**Gate-level detail that matters.** `denomination-2026-07` has already **satisfied** these gates: `numbers_trace`, `dates_iso`, `rowcount_n`, `limitations`, `confidence`, **`falsifier`**, `dictionary`, `cff_valid`, `transforms`, `script`, `regenerated`, `citable`, `checksums`, `csv_json`, `raw_archived`, `downloadable`. Its 8 remaining gates are `no_pii`, `third_party`, `seeds`, `nondeterminism`, `mirrored`, `doi`, `review`, `corrections_closed`.

**Correction records, read verbatim from the ROS:**

- **COR-001** (`denomination-2026-07`, raised 2026-08-08, stage `version_decided`, **open**) — *"Headline 60.3% does not reproduce; three undocumented parser behaviours. Corrected value 55.9%."* Impact: *"Qualitative claim survives (>50%). Specific figure changes by −4.4pp. **Both original defects biased toward the published claim.**"* Version decision: `2.0.0 MAJOR`.
- **COR-002** (`ai-citations-2026-07`, raised and **closed** 2026-08-07) — *"All 89 dates malformed; no date parsed as ISO 8601."* Impact: *"**None on findings** — values were never affected, parsing only."* Version decision: `1.0.1 PATCH`. Full lifecycle recorded: raised → triaged → impact_assessed → version_decided → changelog_written → downstream_identified → corrected → verified → closed.
- **COR-003** (`ai-citations-2026-07`, raised 2026-08-09, stage `raised`, **open**) — *"v1.0.0 data files were not retained when v1.0.1 superseded them; the superseded version is no longer downloadable."*

## 1.4 Existing assets — verified by reading, not by tag or keyword

### `structured-output-contract`

**`content/labs/gemini-structured-output-reliability.mdx` (1,290 words) is a complete before/after failure-rate experiment.** Read in full:

- Hypothesis stated in If/Then/Because form
- Baseline measured: clean JSON ~94%, code-fence wrapping ~4%, explanation prefix ~2% → **parse failure rate ~6%**
- Iteration 2: → **~4%** (*"Marginal improvement — the prose description of the schema did not eliminate decorated output"*)
- Iteration 3: clean JSON ~98%, fences ~1.5% → **<1%**
- Measurement method named: *"SyntaxError events on `JSON.parse()` in the Cloud Function logs"*

The capability's proof task is: *"Show a before/after parse-failure rate with the prompt change that caused it."* **The lab is that artefact, in the Lab's own voice.**

Supporting: `content/docs/ai-output-structure-validation.mdx` (1,706 words) · `content/failures/gemini-json-parse-failure.mdx` — the most complete unit in the corpus at 3/4 beats, with Principle and Practice both linked.

`content/lessons/.../connect-gemini-api.mdx` (W1) teaches *handling* malformed output. A grep for failure-rate/measurement language returns **1 hit**. It does not teach measurement.

### `detect-production-break`

Real signals exist in the repository:

- `app/api/cron/trustseal-monitor/route.ts` — its own header: *"diffs against the prior snapshot, **writes alerts**, and emails digests. Authenticated via CRON_SECRET. **Idempotent** (alerts deduped per domain+kind+day) and **fail-closed**."*
- Six cron routes on disk; four scheduled in `vercel.json` (`autopilot`, `drain-queue`, `billing-reconcile`, `trustseal-monitor`)
- `lib/observability/errors.ts` and `lib/observability/logger.ts`
- Doctrine: `production-observability-doctrine.mdx`, `execution-observability-design.mdx`, `phase-29-monitoring-optimization.mdx`, `incident-response-doctrine.mdx`
- Playbook: `content/playbooks/incident-detection-playbook.mdx`

**No lesson teaches detection.** The five lessons matching monitoring keywords are GA4/GSC/Vercel setup lessons; the match is incidental.

### `ship-a-user-surface`

Two live surfaces with architecture case studies: `scamcheck-architecture-build.mdx` (scamcheck.asquaresolution.com) and `trustseal-architecture-build.mdx` (trustseal.asquaresolution.com). Both are build records, not instruction.

**No lesson teaches shipping a user surface.** The three keyword matches are `ai-tool-stack-budget`, `avoid-tool-subscription-traps`, `google-analytics-data-thinking` — none of which teaches building a page.

## 1.5 Relevant declared-but-empty slots

| Slot | Type | Track / module |
|---|---|---|
| `mvp-with-claude` | lesson | ai-business-zero-budget / first-product |
| `landing-page-system` | lesson | ai-business-zero-budget / first-product |
| `launch-checklist` | checkpoint | ai-business-zero-budget / first-product |
| `ai-ops-monitoring` | lab | claude-code-operator / scaling-systems |
| `runtime-failure-diagnosis` | lab | claude-code-operator / debugging-recovery |
| `testing-ai-code` | lesson | claude-code-operator / product-development |
| `ai-ops-dashboard` | lab | ai-business-zero-budget / systemize |
| `assertion-patterns` | lab | ai-automation-systems / quality-monitoring |

## 1.6 Governance scope — verified from code

`classifyChange()` (`governance.mjs:14-31`) branches only on `graphChanged`, `graduationChanged`, `rubricChanged`, `unitAdded`, `capabilityAdded`, `corrected`. A *unit* is built one-per-file from `content/failures/` (`curriculum.mjs:116`).

**Therefore: adding a lesson is not a governed change.** A lesson is neither a unit nor a capability. Every W4 action that adds a lesson mapped to an existing capability classifies as **`none`**.

---

# 2. INFERENCES

Clearly separated from §1. These are my judgements, not repository facts.

**2.1 `ship-a-user-surface` is the highest-leverage single gap.** Facts: it is Building's only capability; Building gates Evidencing and Distributing; Building is 0/1 taught. Inference: teaching it is the one action that changes the shape of the coverage map rather than adding to a count. *Caveat, stated precisely:* `graph.mjs unlocked()` gates on **proven**, not **taught**. This is a curriculum-sequencing argument, not a claim that the engine blocks anything today.

**2.2 `structured-output-contract` needs framing, not evidence.** The lab already contains the exact measurement the proof task demands. Inference: the gap is that a company experiment is not a student task — no setup, no reproduction path, no "now measure your own." Converting it is materially cheaper than authoring.

**2.3 The Evidencing pair splits into method and number.** Fact: the engine's rule is *teaching a number under correction propagates the defect*. Fact: COR-002 is closed with impact *"None on findings."* Fact: `denomination-2026-07` has satisfied the `falsifier` and `limitations` gates. Inference: teaching the *discipline* — how a falsifier is stated, how a correction is run, what `releasable: false` means — is possible without teaching any number under correction. Teaching the denomination *finding* is not.

**2.4 COR-001 is an unusually strong teaching artefact for `falsifiable-claim`.** A published headline that did not reproduce, caught by internal audit, with the corrected value and the honest admission that *both original defects biased toward the published claim*. That is a falsifier firing in real life on the company's own work. Inference: it teaches the capability better than any synthetic example could — **but it is an open correction**, so using it now would contradict the engine's own rule.

**2.5 `detect-production-break` has the best evidence-to-instruction ratio of the three unblocked capabilities**, because the signals are live code the student can be pointed at, not prose.

---

# 3. RECOMMENDATIONS

## Per-capability analysis (A–F)

### ① `ship-a-user-surface` — Building — **P0**

- **A. Meaning.** *"You can ship a page that a stranger can use without instructions."* Proof: *"Link a live page and describe the one action a user takes on it."* Artefact: a URL. Building's description: *"Can build a product surface that real users reach."*
- **B. Partial existing asset?** **No.** Two case studies describe live surfaces but are build records, not instruction. No lesson teaches it.
- **C. New lesson required?** **Yes.**
- **D. Blocked by evidence?** **No.** Two live production surfaces exist with full architecture records.
- **E. Verdict:** **teach now**.
- **F. Strongest evidence:** it is the only capability under Building; Building gates Evidencing and Distributing; prerequisite Foundations is 3/3 taught. Nothing blocks it and the most sits behind it.

**Proposed action.** One lesson filling `ai-business-zero-budget/first-product/mvp-with-claude` or `landing-page-system`. Grounded in `scamcheck-architecture-build.mdx` and `trustseal-architecture-build.mdx`. **Must not duplicate:** `vercel-for-beginners` (deployment), `deployment-pipeline` (the ship loop), `free-tier-architecture` (stack choice). Its subject is *the surface a stranger can use*, not the deploy. Maps to the existing capability; **no new unit or capability**. Governance: **none**.

### ② `structured-output-contract` — Integrating — **P1**

- **A. Meaning.** *"You can make a language model return output your parser accepts, and prove the failure rate fell."* Proof: *"Show a before/after parse-failure rate with the prompt change that caused it."* `derived_from_incident: gemini-json-parse-failure`.
- **B. Partial existing asset?** **Yes, and it is strong but unmapped.** `labs/gemini-structured-output-reliability.mdx` contains the complete measurement (6% → 4% → <1%, method named). It is a *lab* — Practice-beat material — not a lesson, and carries no `proves`.
- **C. New lesson required?** **Partially.** The evidence exists; the instruction does not.
- **D. Blocked by evidence?** **No.** Best-evidenced of all five.
- **E. Verdict:** **teach after ①**, or alongside if capacity allows.
- **F. Strongest evidence:** the unit `gemini-json-parse-failure` is the corpus's most complete at 3/4 beats, with Principle (`ai-output-structure-validation.mdx`) and Practice (the lab) both linked.

**Proposed action.** Either (a) map the existing lab via `proves` — **cheapest, but see §5 for why it is questionable** — or (b) a short lesson that teaches measuring a parse-failure rate, grounded in the lab. **Must not duplicate** `connect-gemini-api`, which teaches *handling* branches; this teaches *measuring* whether handling improved. Governance: **none**.

### ③ `detect-production-break` — Operating — **P1**

- **A. Meaning.** *"You can tell that production is broken without a user telling you."* Proof: *"Show the signal — log, alert, dashboard or scheduled check — that would surface a failure in a system you run, and when it last fired."* Operating is **mandatory for graduation** (`certification.json`) and noted as *"the strongest and least-exploited competency."*
- **B. Partial existing asset?** **No lesson.** Doctrine and a playbook exist; both are company-internal reference.
- **C. New lesson required?** **Yes.**
- **D. Blocked by evidence?** **No.** Richest code-level evidence of the three: `trustseal-monitor` (idempotent, fail-closed, deduped alerts), four scheduled crons, `lib/observability/`.
- **E. Verdict:** **teach now or immediately after ①**.
- **F. Strongest evidence:** Operating has 7 primary units and 18 teaching units — the largest pool — and one taught capability out of two.

**Proposed action.** Fill `claude-code-operator/scaling-systems/ai-ops-monitoring` (declared lab, 50 min). Grounded in `trustseal-monitor/route.ts`, `lib/observability/`, `production-observability-doctrine.mdx`, `incident-detection-playbook.mdx`. **Must not duplicate** `debugging-methodology` (diagnosing a known break) or `post-mortem-process` (writing it up afterwards); this is *knowing it broke at all*. Governance: **none**.

### ④ `claim-with-dataset` — Evidencing — **DEFER (partially blocked)**

- **A. Meaning.** *"You can state a measured claim and attach the data behind it."* Proof: *"Publish a claim, its dataset, its sample size and at least one limitation. **A claim with no stated limitation is returned.**"* `governed_by: RESEARCH_STANDARD.md`.
- **B. Partial existing asset?** No lesson. `google-analytics-data-thinking` teaches metric selection, not claim construction.
- **C. New lesson required?** Yes — eventually.
- **D. Blocked by evidence?** **Partially.** All three studies are `releasable: false`. But `denomination-2026-07` has satisfied `numbers_trace`, `rowcount_n`, `limitations`, `dictionary`, `csv_json`, `downloadable` and passes 189/189 reproducibility checks. **The method is demonstrable; the headline number is not.**
- **E. Verdict:** **blocked pending evidence for the number; the method could be taught from the ROS gate list without citing a figure under correction.** Recommend deferring regardless — see ⑤ and §4.
- **F. Strongest evidence:** ROS `status.json` gate arrays, verified this session.

### ⑤ `falsifiable-claim` — Evidencing — **DEFER (blocked)**

- **A. Meaning.** *"You can state what observation would have proved you wrong."* Proof: *"For a claim you have made, write the observation that would falsify it."*
- **B. Partial existing asset?** **None.**
- **C. New lesson required?** Yes — eventually.
- **D. Blocked by evidence?** **Yes, and instructively so.** The single best artefact is **COR-001**, and it is open. Teaching from it now would use a number under correction as the worked example — precisely what the engine forbids.
- **E. Verdict:** **blocked pending research**.
- **F. Strongest evidence:** COR-001 is at stage `version_decided`, not `closed`; `denomination-2026-07` remains `releasable: false`.

**Do not manufacture evidence to close this gap.** The honest position is that the Lab's best falsifiability lesson is waiting on its own correction to close — which is itself the strongest possible demonstration that the standard is real.

## Ranked table

| # | Capability | Competency | Current state | Existing assets | Evidence quality | Dependency | Recommendation | Next smallest safe action |
|---|---|---|---|---|---|---|---|---|
| **P0** | `ship-a-user-surface` | building | untaught | none (2 case studies, not instruction) | **strong** — 2 live surfaces | none; foundations 3/3 | **Teach now** | One lesson into an existing `first-product` slot |
| **P1** | `detect-production-break` | operating | untaught | doctrine + playbook, no lesson | **strong** — live crons, `lib/observability/` | none; foundations 3/3 | **Teach now / next** | Fill `ai-ops-monitoring` (declared lab) |
| **P1** | `structured-output-contract` | integrating | untaught | **lab with the exact measurement**, unmapped | **strongest** — full before/after | none; foundations 3/3 | **Teach after P0** | Short lesson grounded in the lab |
| **P2 / DEFER** | `claim-with-dataset` | evidencing | untaught | none | **method yes, number no** | building 0/1 | **Defer** | Re-check ROS when COR-001 closes |
| **BLOCKED** | `falsifiable-claim` | evidencing | untaught | none | **blocked** — best artefact is open | building 0/1 | **Blocked** | Wait for COR-001 → `closed` |

---

# 4. BLOCKED / DEPENDENT ITEMS

| Item | Nature | Owner | Unblocks when |
|---|---|---|---|
| `falsifiable-claim` | Blocked — best artefact (COR-001) is an open correction | ROS / RESEARCH_STANDARD | COR-001 reaches `closed`; `denomination-2026-07` becomes releasable |
| `claim-with-dataset` | Partially blocked — method demonstrable, number under correction | ROS | as above, or a decision to teach method-only |
| Both Evidencing capabilities | Dependent — Evidencing requires building, and building is 0/1 taught | curriculum | after ① `ship-a-user-surface` |
| `approved_by: "pending"` | Certification blocked entirely | founder | founder approval |
| Proof beat | Hardcoded absent; 3/4 is the permanent ceiling | project engine (does not exist) | out of W4 scope |
| `teachable: 5` | Overstated — 2 genuine, 1 weak, 2 tag-collision false positives | — | separate change; **not W4** |

---

# 5. Mappings that should NOT be made

1. **Do not map `labs/gemini-structured-output-reliability.mdx` to `structured-output-contract` via `proves` as a shortcut.** `proves` is declared on lesson entries in `lib/tracks.ts`; that lab is not a lesson and has no entry. Forcing it would put a Practice-beat document into the teaching layer and blur the two.
2. **Do not map the ScamCheck/TrustSeal case studies to `ship-a-user-surface`.** They are build records. The capability is about a stranger using a page without instructions; a case study teaches neither.
3. **Do not map `debugging-methodology` or `post-mortem-process` to `detect-production-break`.** They cover diagnosis and write-up — after you know it broke.
4. **Do not map `google-analytics-data-thinking` to `claim-with-dataset`.** It teaches choosing metrics, not attaching a dataset with a stated limitation.
5. **Do not add a capability to make any of this fit.** Adding one is governance class **minor** and requires curriculum-owner approval.
6. **Do not fix `teachable` inside W4.**

---

# 6. Governance classification of each proposed action

| Action | `classifyChange` inputs | Class |
|---|---|---|
| New lesson → existing capability (①②③) | all false | **none** |
| Adding `proves` to an existing lesson | all false | **none** |
| Adding a new capability | `capabilityAdded: true` | **minor** |
| Adding a unit (i.e. a new failure doc) | `unitAdded: true` | **minor** |
| Changing the graph, rubric, or graduation | respective flag | **major** |

**Every action recommended in this audit is governance class `none`.** Verified from `governance.mjs:14-31`: the classifier governs University artefacts only — units, capabilities, graph, rubric, graduation. Lessons fall outside its scope entirely.

---

# 7. Recommended execution order

**W4a — `ship-a-user-surface` (P0).** One lesson into an existing `first-product` slot. It is Building's only capability, Building gates Evidencing and Distributing, and its prerequisite is fully taught. This is the single action that changes the shape of the coverage map. Coverage 6 → 7 of 11; Building 0/1 → 1/1.

**W4b — `detect-production-break` (P1).** Fill the declared `ai-ops-monitoring` lab. Operating is mandatory for graduation and has the largest unit pool. Coverage 7 → 8 of 11.

**W4c — `structured-output-contract` (P1).** A short lesson grounded in the existing lab, teaching measurement rather than handling. Coverage 8 → 9 of 11.

**Then stop and re-audit.** Do not attempt the Evidencing pair in W4.

**W4d (not scheduled) — re-check the ROS.** When COR-001 closes and `denomination-2026-07` becomes releasable, `falsifiable-claim` gains the strongest worked example the Lab will ever have. Until then it stays untaught, and the coverage line honestly reads **9 of 11**.

**Three lessons total, each into an existing declared slot, each mapped to an existing capability, each governance class `none`.** Coverage would move 6 → 9 of 11 with the remaining 2 openly blocked — which is the honest end state, not a full board.

---

## Appendix — integrity at time of audit

```
HEAD                : 5408beb7d2a73f21931442e80e7a61f013bb53eb   sync 0/0   staged 0
lib/university      : 15 files, byte-identical before and after
lib/university/data : unchanged
state/ directory    : absent — no student state created
mutating commands   : governance/student/prove/assess NOT run
working tree        : 122 entries before; only this report added

ROS status.json generated 2026-08-09T11:50:30+00:00 (19 days stale, unchanged)
all three studies releasable: false
```
