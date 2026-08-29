# W4b — Detection Capability Audit

**Date:** 2026-08-28 · **HEAD:** `ee119984a55debfb82f58badb382abd1e8d8801e`
**Target capability:** `detect-production-break` · **Competency:** Operating
**Mode:** discovery only. Nothing implemented, modified, staged, committed, pushed or deployed. Read-only commands only; `governance`, `student`, `prove`, `assess` **not run** (governance class computed by calling the pure `classifyChange()` function, which writes nothing).

---

## 1. Executive verdict

**Yes — `detect-production-break` is genuinely unblocked, and the repository contains an unusually complete detection chain in real production code.** Every stage of the chain named in the brief is supported by a source file, with line-level references. Nothing needs to be invented.

**But the declared slot is wrong for this capability, and that is the one decision this audit cannot make alone.**

`ai-ops-monitoring` is `type: 'lab'`, titled **"AI Ops Monitoring Dashboard"**, described as *"Build a monitoring dashboard for long-running AI automation jobs."* The capability is *"You can tell that production is broken without a user telling you"*, and its proof task accepts **"log, alert, dashboard or scheduled check"**. The slot names one of the four signal types and narrows the subject to AI automation jobs. Meanwhile the repository's strongest evidence — the TrustSeal monitor — is a **scheduled check that writes alerts and emails a digest**, not a dashboard.

Writing the lesson to fit the slot title would teach dashboard construction. Writing it to fit the capability would leave the slot title inaccurate. §11 sets out three options; **the choice is yours, not mine.**

**One lesson is sufficient.** The evidence supports a single, dense instructional asset. It should not become two.

---

## 2. Capability definition

```json
{
  "id": "detect-production-break",
  "competency": "operating",
  "statement": "You can tell that production is broken without a user telling you.",
  "proof_task": "Show the signal - log, alert, dashboard or scheduled check - that would surface a failure in a system you run, and when it last fired.",
  "proof_artifact": "signal reference"
}
```

**Competency context** (`competencies.json`):

```json
{
  "id": "operating", "name": "Operating", "scope": "monitoring, incident response",
  "requires": ["foundations"],
  "description": "Can detect that production is broken, diagnose it from evidence, and write up what happened.",
  "note": "The strongest and least-exploited competency - the failure corpus and operational logs live here."
}
```

Operating holds exactly two capabilities: `detect-production-break` (untaught) and `write-a-postmortem` (taught by W2). Its only prerequisite, Foundations, is **3/3 taught**. Operating is the competency `certification.json` makes **mandatory for graduation**.

Two things follow from the statement, and they bound the lesson:

- **"without a user telling you"** — the subject is the signal, not the diagnosis. Diagnosis is a different lesson that already exists.
- **"and when it last fired"** — a signal that has never fired, or whose last firing cannot be shown, does not satisfy the proof task. Liveness is part of the capability.

---

## 3. The existing `ai-ops-monitoring` slot

`lib/tracks.ts:284`, module `scaling-systems`, track `claude-code-operator`:

```js
{ id: 'ai-ops-monitoring', title: 'AI Ops Monitoring Dashboard', type: 'lab',
  duration: '50 min',
  description: 'Build a monitoring dashboard for long-running AI automation jobs.',
  status: 'coming-soon' }
```

**Fit assessment against the capability:**

| Dimension | Slot | Capability | Fit |
|---|---|---|---|
| Subject | build a dashboard | tell that production is broken | ⚠ partial — dashboard is 1 of 4 accepted signal types |
| Scope | long-running AI automation jobs | any system you run | ⚠ narrower |
| Type | `lab` | instruction | ⚠ see below |
| Module | scaling-systems | operating discipline | ⚠ arguably `debugging-recovery` |
| Duration | 50 min | adequate | ✅ |

**On `type: 'lab'`** — this is *not* a blocker. Precedent exists: three of the ten currently mapped assets are `type: 'playbook'` (`bad-commit-recovery`, `build-failure-diagnosis`, `google-search-console-setup`). In `lib/tracks.ts`, `type` is a display label; it is unrelated to the University's Practice beat, which reads only `content/labs/`. A `lab`-typed track entry can carry `proves`.

**Alternative slots examined** (all `coming-soon`):

| Slot | Type | Verdict |
|---|---|---|
| `runtime-failure-diagnosis` (debugging-recovery, 40 min) | lab | ❌ *"Diagnose failures that only appear in production"* — diagnosis, i.e. after detection |
| `ai-ops-dashboard` (zero-budget/systemize, 35 min) | lab | ❌ also dashboard-framed, and beginner track |
| `personal-ops-playbook` (scaling-systems, 90 min) | project | ❌ a capstone, not an instructional asset |
| `assertion-patterns` (ai-automation-systems, 40 min) | lab | ❌ in a hollow track with 0 built lessons |
| `churn-detection-solo` (solo-ai-founder) | lesson | ❌ business metric, hollow track |

**No existing slot is a clean fit.** `ai-ops-monitoring` is the closest.

---

## 4. Repository evidence inventory

### A. Existing implementation evidence — **STRONG**

| File | Lines | What it provides |
|---|---|---|
| `app/api/cron/trustseal-monitor/route.ts` | 23 | Scheduled entry point, auth, fail-closed error path |
| `lib/trustseal/monitoring/scan.ts` | 115 | The scan: snapshot → re-verify → diff → alert → digest |
| `lib/trustseal/monitoring/diff.ts` | 65 | **Pure** comparison function, no imports, explicitly *"unit-testable"* |
| `lib/trustseal/monitoring/alerts.ts` | 61 | Alert persistence, idempotency, ownership guard |
| `lib/observability/errors.ts` | 84 | `reportError` → structured log + durable `error_reports` record, fingerprinting |
| `lib/observability/logger.ts` | 60 | Levelled structured logging, `timed()` helper |
| `vercel.json` | — | Four scheduled crons, including `trustseal-monitor` daily at 04:00 |

### B. Existing instructional evidence — **NONE**

No lesson and no lab teaches detection. What exists is doctrine and reference:

| Document | Words | Nature |
|---|---|---|
| `docs/incident-response-doctrine.mdx` | 4,634 | company doctrine |
| `docs/operational-invariants.mdx` | 4,320 | invariant catalogue |
| `docs/production-observability-doctrine.mdx` | 3,758 | doctrine |
| `docs/execution-observability-design.mdx` | 3,352 | design record |
| `playbooks/incident-detection-playbook.mdx` | 2,089 | internal runbook |
| `docs/phase-29-monitoring-optimization.mdx` | 1,115 | phase record |

The three lessons that match monitoring keywords (`google-analytics-data-thinking`, `google-search-console-setup`, `deployment-pipeline`) match incidentally; none teaches production-break detection.

### C. Existing incident evidence — **STRONG, and better than expected**

**10 of 20 failure documents carry a `time_to_detect` field.** Read verbatim, they form a real taxonomy of how breaks were actually noticed:

| Failure | Sev | `time_to_detect` | Detected by |
|---|---|---|---|
| `server-module-client-bundle` | high | *"Immediate — next build fails with Module not found"* | build gate |
| `edge-runtime-deployment-failure` | high | *"2 minutes — next push after the change"* | deploy gate |
| `wordpress-rest-api-auth-failure` | med | *"Immediate — first API call returns 401"* | API response |
| `vite-github-pages-spa-routing` | high | *"Immediate on first direct URL visit or refresh"* | first real use |
| `next-mdx-remote-v6-blockjs` | med | *"Manual visual inspection post-deploy — **build succeeded**"* | **a human looking** |
| `ga4-cross-domain-tracking-gap` | low | *"Noticed in GA4 reports — unusually high new session rate"* | an analytics anomaly |
| `gsc-index-coverage-drop` | low | *"3 days post-deployment — visible in GSC Coverage report"* | third party, days later |
| `dns-subdomain-propagation-delay` | med | *"Appears resolved after 20 minutes, **fails for other regions/users**"* | **a false all-clear** |
| `environment-variable-missing-production` | high | *"**Found after user testing in production** — feature appeared to work in dev"* | **a user** |
| `claude-code-context-exhaustion` | med | *"At context limit — Claude Code surfaced a continuation summary"* | the tool itself |

Two of these are the capability failing, in the Lab's own records: `environment-variable-missing-production` was found by a user, and `dns-subdomain-propagation-delay` produced a false all-clear. That is the strongest possible motivation for the lesson and it is already written down.

### D. Genuine gap — **YES**

Implementation exists. Incidents exist. Doctrine exists. **Instruction does not.** One lesson.

### E. Things that would be invention if written — **do not write these**

- Uptime percentages, MTTR, SLOs, error budgets — **no such figure exists anywhere in the repository**
- Alert volumes, how many alerts have fired, when the cron last fired
- Any claim that the monitor *caught* a specific named incident — no record links the two
- Customer impact, subscriber counts, revenue effect of an outage
- Dashboards, on-call rotations, paging, Grafana/Datadog/Sentry — none exists
- Any threshold not in `diff.ts`

---

## 5. Detection-chain analysis

The chain from the brief, mapped to source. **Every stage is supported.**

| Stage | Supported | Evidence |
|---|---|---|
| **production state** | ✅ | `scan.ts:32` — `ts_claims` where `status == 'verified'` |
| **observation / snapshot** | ✅ | `scan.ts:59-64` — `before` = last `readVerificationHistory` row → `{band, score, signals}` |
| **re-observation** | ✅ | `scan.ts:68` — `getVerification(domain, {forceRefresh:true})` re-checks DNS/SSL/reputation |
| **comparison** | ✅ | `diff.ts:33-63` — `diffSnapshot(prev, cur)`, pure, no imports |
| **invariant (time-based)** | ✅ | `scan.ts:82-84` — `reverify_due` when `now - lastCheckedAt > 90 days` |
| **detection signal** | ✅ | `diff.ts:14-23` — 6 `AlertKind`, 3 `AlertSeverity`, with `from`/`to` |
| **thresholds** | ✅ | `diff.ts:26-27` — `BAND_RANK`, `SCORE_DROP_THRESHOLD = 10`; band_down is `critical` when new rank ≤ 2 |
| **noise suppression** | ✅ | `diff.ts:41-42` — score drop flagged **only when the band held**: *"a band change already says more"* |
| **alert / recorded event** | ✅ | `alerts.ts:27-33` — `writeAlert` → `ts_alerts` |
| **deduplication** | ✅ | `alerts.ts:28-29` — id is `accountId__domain__kind__day`; a daily scan cannot duplicate |
| **failure handling** | ✅ | Two layers, deliberately different — see below |
| **bounded work** | ✅ | `scan.ts:19-20` — `MAX_DOMAINS = 25`, `RECHECK_AFTER_MS = 20h` |
| **operator action** | ✅ | `scan.ts:96-111` — per-account email digest, only for `severity !== 'info'` |

**The two failure-handling layers are a teachable distinction in themselves:**

- `scan.ts:27` — *"Best-effort throughout; never throws."* The scan swallows per-domain errors so one bad domain cannot stop the pass.
- `route.ts:19-22` — **fail-closed**: any throw becomes `reportError('cron.trustseal_monitor', …, {severity:'error'})` plus HTTP 500.
- `alerts.ts:6` — *"monitoring must never break a request path."*
- `errors.ts:46-48` — when the store is unavailable, `reportError` returns `''` and the comment states the fallback plainly: *"the log line is the durable record."*

**What is NOT detected — read from the code, and the most valuable teaching material here:**

1. `scan.ts:34` — if the initial store query throws, the function returns an empty result. **The store being down produces `scanned: 0` and no alert.** A silent no-op is indistinguishable from a clean run.
2. `scan.ts:70` — `catch { continue }`: a domain that cannot be verified at all yields no alert.
3. `scan.ts:51` — only monitoring-entitled (Business/Pro) accounts are scanned; the rest increment `skipped`.
4. `scan.ts:19` — at most 25 domains re-verified per run.
5. Daily cadence — a break that starts and ends between runs is never seen.
6. **Nothing monitors the monitor.** If the cron stops firing, no signal exists anywhere in this code to say so. The proof task's *"and when it last fired"* is precisely the question this system cannot answer about itself.

---

## 6. Existing instructional overlap

| Lesson | Covers | Boundary |
|---|---|---|
| `debugging-methodology` (available) | three laws, debugging sequence, binary search, isolating, verifying fixes | **After** you know it broke |
| `reading-build-errors` (available) | TypeScript, module resolution, Next.js error anatomy | Reading an error you already have |
| `post-mortem-process` (available, W2) | the six-section format, rubric, evidence vs assumption | **After** it is fixed |
| `deployment-pipeline` (available) | local build loop, pre-push script, post-deployment verification | Verification **at deploy time**, not continuously |
| `env-vars-secrets` (available) | .env, Vercel config, rotation, failure patterns | Config, not detection |

**The uncovered space is precise:** how you learn something broke, when nobody is looking and no deploy is running. `deployment-pipeline` is the nearest neighbour and stops at the deploy; this lesson starts the day after.

---

## 7. What the new lesson would need to teach

1. The four signal types the proof task accepts, and that a signal which never fires is not a signal
2. Snapshot → re-observe → compare: detection is a **diff against a prior state**, not an inspection
3. Invariants that fire on absence (`reverify_due`) as well as on change
4. Severity and thresholds as deliberate choices, with the Lab's real numbers
5. Noise suppression — why a score drop is suppressed when the band already moved
6. Idempotency: why a daily scan must not re-alert daily for the same condition
7. Fail-closed at the boundary, best-effort inside, and why they differ
8. **What the system cannot see** — the honest limits, including that nothing watches the watcher
9. The empirical taxonomy from `time_to_detect`: build gate · first use · human looking · third party days later · **a user** — and that the last is the capability failing

---

## 8. Evidence-supported lesson outline

Every section maps to a source. Nothing here requires invention.

| § | Section | Source |
|---|---|---|
| 1 | *A user telling you is not detection* | `environment-variable-missing-production` and `dns-subdomain-propagation-delay` `time_to_detect` fields |
| 2 | *What the build gate already catches for free* | `server-module-client-bundle`, `edge-runtime-deployment-failure`, `wordpress-rest-api-auth-failure` |
| 3 | *The green-build blind spot* | `next-mdx-remote-v6-blockjs` — *"build succeeded"*, found by manual inspection |
| 4 | *Detection is a diff, not an inspection* | `scan.ts:59-78` before/after snapshots |
| 5 | *Deciding what counts as a change* | `diff.ts:26-60` — BAND_RANK, threshold 10, severity rules |
| 6 | *Suppressing the noise you would otherwise ignore* | `diff.ts:41-42` |
| 7 | *Invariants that fire on absence* | `scan.ts:82-84` `reverify_due` |
| 8 | *An alert nobody reads twice* | `alerts.ts:27-33` dedup key |
| 9 | *Fail-closed outside, best-effort inside* | `route.ts:19-22` vs `scan.ts:27`, `alerts.ts:6`, `errors.ts:46-48` |
| 10 | *What this system cannot see* | `scan.ts:34`, `:51`, `:70`, `:19`; and nothing monitors the monitor |
| 11 | *Your signal, and when it last fired* | the proof task |

Target ~1,800–2,000 words, consistent with W2 (1,857) and W4a (1,697).

---

## 9. What must NOT be claimed

- **No uptime, MTTR, SLO, error-budget or alert-volume figure.** None exists in the repository.
- **No claim that the monitor caught any specific incident.** No record connects `trustseal-monitor` to any failure document.
- **No claim about when the cron last fired.** Not knowable from the repository, and §5 shows the system cannot answer it about itself.
- **No third-party tooling** (Sentry, Datadog, PagerDuty, Grafana) — none is used.
- **No on-call, paging or rotation practice** — none exists.
- **No customer or revenue impact.**
- **No threshold other than those in `diff.ts`.**
- **Do not present the TrustSeal monitor as complete.** Its gaps in §5 are part of the teaching, not an embarrassment to omit.

---

## 10. Governance classification

Computed by calling `classifyChange()` directly (pure function; the mutating `governance` CLI command was not run):

```json
{ "class": "none", "why": "no governed change detected", "requires": [], "notice": false }
```

Inputs all false: no graph change, no graduation change, no rubric change, no unit added, no capability added, no correction. **Governance class `none`** — consistent with W2, W3b and W4a. No `curriculum_version` bump, no approval record, no notice.

*Caveat:* if the slot's `title`/`description` are amended (Option A in §11), that is a change to Lab track metadata, not to University curriculum. The classifier still returns `none`, because it governs units, capabilities, graph, rubric and graduation only.

---

## 11. Proposed minimal implementation — **decision required**

| | Option A — **recommended** | Option B | Option C |
|---|---|---|---|
| Slot | `ai-ops-monitoring` | `ai-ops-monitoring` | new lesson in `debugging-recovery` |
| Metadata | amend `title` + `description` to match the capability | preserve exactly | new entry |
| Content | detection, dashboard as one of four signals | dashboard-building lab | detection |
| Pro | slot filled, subject correct, promise count drops | zero metadata change | best module fit |
| Con | changes two declared strings | **teaches the wrong subject** | adds a lesson entry rather than filling one |

**Recommended: Option A**, with the title amended to something like *"Detecting a Production Break"* and the description to the capability's own subject. Rationale: the strongest evidence is a **scheduled check**, not a dashboard; the slot's current description would force the lesson away from the capability it is meant to teach.

Precedent cuts both ways and should be stated honestly: in W2 and W4a I preserved slot metadata exactly. Amending it here is a departure, justified only because the mismatch is substantive rather than cosmetic. **If you prefer strict preservation, choose Option B and accept that the lesson teaches dashboards — in which case `proves: ['detect-production-break']` would be an overclaim and should not be added.**

**Files touched under Option A:** `lib/tracks.ts` (status → `available`, add `proves`, amend title + description) and one new `content/lessons/claude-code-operator/scaling-systems/ai-ops-monitoring.mdx`. Nothing in `lib/university/`.

---

## 12. Expected University coverage change

| | Before | After |
|---|---|---|
| capabilities taught | 7 of 11 | **8 of 11** |
| untaught | 4 | **3** — `structured-output-contract`, `claim-with-dataset`, `falsifiable-claim` |
| mapped assets | 10 | **11** |
| Operating capabilities taught | 1 of 2 | **2 of 2 — complete** |
| available / coming-soon | 55 / 83 | 56 / 82 |

**Operating would become the first fully-taught competency.** It is also the one mandatory for graduation.

Unchanged: competencies 6 · capabilities 11 · units 20 · teachable 5 · missing principle 7 · missing practice 15 · students 0 · unknown mappings 0.

---

## 13. Verification gates for the implementation phase

`tsc --noEmit` · scam-intel 30/30 · all six University read-only commands exit 0 · **`curriculum` and `unit` output byte-identical** · `next build` passes · route resolves, `Coming Soon` = 0 · `proves` resolves, unknown = 0 · taught 7 → 8, untaught 4 → 3, mapped 10 → 11 · invariants unchanged · `lib/university` byte-identical · no `state/` · tree delta exactly 2 paths · existing 10 mappings undrifted.

---

## 14. Working-tree integrity

```
HEAD                : ee119984a55debfb82f58badb382abd1e8d8801e   sync 0/0   staged 0
lib/university      : 15 files, byte-identical before and after
lib/university/data : unchanged        lib/university/engine : unchanged
lib/tracks.ts       : unchanged        content/lessons        : unchanged
state/ directory    : absent — no student state created
mutating commands   : governance/student/prove/assess NOT run
working tree        : 123 entries before; only this report added
```

---

## Answers to the report's required questions

**Is `detect-production-break` genuinely unblocked?** Yes. Foundations 3/3 taught; no dependency; complete implementation evidence; strong incident evidence.

**Is `ai-ops-monitoring` the correct existing slot?** It is the **closest**, not a clean fit. Its title and description describe dashboard-building for AI automation jobs; the capability is broader and the best evidence is a scheduled check. Resolvable by Option A; see §11.

**Is there enough real repository material?** Yes, comfortably — 348 lines of monitoring implementation, 144 lines of observability, and 10 failure records carrying `time_to_detect`.

**What exact source files support each claim?** §5 and §8, line-referenced.

**What is still missing?** Nothing needed for the lesson. Missing *from the system* (and therefore teachable as honest limits): store-failure silence, per-domain verification failures, entitlement gating, the 25-domain cap, daily cadence, and no monitor-of-the-monitor.

**Would one lesson be sufficient?** Yes. One, ~1,800–2,000 words.

**What should remain ordinary Lab content?** All six doctrine documents and the incident-detection playbook — they are company reference, cited by the lesson but not converted. `runtime-failure-diagnosis`, `ai-ops-dashboard`, `personal-ops-playbook` and `assertion-patterns` stay `coming-soon`; none should be pulled into this capability.
