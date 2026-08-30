# W6 Item 2A — Stale Lab Guidance Correction

**Date:** 2026-08-30 · **HEAD:** `f3136ee2813e897861b41568763bf1d9e843f002`
**Scope:** one string, one file. Practice matcher, curriculum data, incidents, labs, `governance.json`, `curriculum_version`, certification code and `route.ts` all untouched. Nothing staged, committed, pushed or deployed.

---

## A. Snapshot

```
HEAD / origin        : f3136ee…  identical, ahead/behind 0/0
staged               : 0        worktrees : 1        state/ : absent
tracked modifications: app/api/scam-intel/quick-check/route.ts  (pre-existing)
untracked            : 125      porcelain : 126
assessment.mjs  sha  : 496743a0be9bfde1b0fcd65bcb0407f6   (before)
curriculum.mjs  sha  : ea42cccc4d90a16806df462392c15903
governance.json sha  : f0462e13b6eb094d6d31950065f3ea0d   curriculum_version : 1.0.0
```

---

## B. Obsolete guidance

`lib/university/engine/assessment.mjs:136`, inside `reproductionTask()`:

```js
export function reproductionTask(unit) {
  if (!unit.beats.practice.present) {
    return {
      unit: unit.id,
      available: false,
      reason: 'no reproduction lab matches this incident',
      needed: `a lab sharing at least 2 tags with ${unit.beats.incident.source}`,   // ← obsolete
    }
  }
```

**What a student saw.** Reached via `university.mjs lab <id>` on any unit lacking Practice — **17 of 20 units**. It instructed the student to satisfy a two-tag-overlap rule that the engine has not applied since W5a. Following it exactly would produce a lab that still fails to register: tags are informational and are never consulted by the matcher.

It also pointed at the incident's **file path** (`content/failures/x.mdx`) rather than the **slug**, which is the value the matcher actually compares.

---

## C. Current executable contract

`curriculum.mjs:104-107`, unchanged by this work:

```js
function findPractice(incident, labs) {
  const hit = labs.find(l => (l.fm.reproduces ?? []).includes(incident.slug))
  return hit ? { doc: hit, via: 'reproduces' } : null
}
```

Its own docblock states the rule the message should have been giving:

> *A lab names the incidents it reproduces in `reproduces: [<incident slug>]`. Nothing is inferred: same vendor, same platform, **same tags** or same subsystem do not make a lab a reproduction of an incident… Tag overlap was used here previously and produced four false positives out of five matches.*

Corroborated by `W5A_PRACTICE_MATCHING_DESIGN_2026-08-28.md:24` — *"an explicit `reproduces:` key on labs holding incident **slugs**… Tag inference is removed entirely"* — and by `W5B_CLOSEOUT_2026-08-29.md:15`, which records `findPractice()` as explicit-only with no tag fallback.

**The value compared is the incident slug**, and `unit.id` is exactly that (`curriculum.mjs:145` — `id: inc.slug`).

---

## D. Repository-wide occurrence search

Searched all of `lib/`, `app/`, `components/`, `scripts/`, `eval/` plus a whole-repo pass for `at least 2 tags`, `at least two tags`, `two tags`, `sharing at least`, `shares at least`, `tag overlap`, `tag-overlap`, `tag intersection`.

**Exactly one source-code occurrence — `assessment.mjs:136`.** No second copy exists in any engine module, route, component or script.

Other engine matches were checked and are **correct as written** — they document the *absence* of tag matching and must not change:

```
curriculum.mjs:97   "Nothing is inferred: same vendor, same platform, same tags or same subsystem"
curriculum.mjs:101  "Tag overlap was used here previously and produced four false positives…"
graph.mjs:111       "Assets come from explicit `proves` declarations, never from tag overlap."
```

`curriculum.mjs:31` (`for (const t of sig.tag ?? [])`) belongs to `classify()`, the competency scorer — a different subsystem that legitimately uses tags and is out of scope.

---

## E. Minimal correction

One line, one file. `+1 −1`:

```diff
--- a/lib/university/engine/assessment.mjs
+++ b/lib/university/engine/assessment.mjs
@@ -133,7 +133,7 @@ export function reproductionTask(unit) {
        unit: unit.id,
        available: false,
        reason: 'no reproduction lab matches this incident',
-      needed: `a lab sharing at least 2 tags with ${unit.beats.incident.source}`,
+      needed: `a lab in content/labs/ declaring \`reproduces: [${unit.id}]\` in its frontmatter`,
      }
```

Rendered against real units:

```
NO-PRACTICE  claude-code-context-exhaustion
  reason : no reproduction lab matches this incident
  needed : a lab in content/labs/ declaring `reproduces: [claude-code-context-exhaustion]` in its frontmatter

HAS-PRACTICE edge-runtime-deployment-failure
  available=true  lab=content/labs/edge-runtime-deployment-reproduction.mdx
```

The message now names the file the student must create, the exact key, and the exact slug value the matcher compares — and it is copy-pasteable. Nothing else in `reproductionTask()` changed; the `steps` array, the `available: true` branch and every other field are byte-identical.

---

## F. Regression results

| Gate | Result |
|---|---|
| `tsc --noEmit` | **exit 0**, no diagnostics |
| scam-intel suite | **30/30 pass**, 0 fail |
| `next build` | **exit 0** — `✓ Compiled successfully in 11.8s` |
| Page count | **1033 / 1033** — unchanged, **no new routes** |

| Metric | Required | Observed |
|---|---|---|
| Practice relationships | 3 | **3** ✅ |
| teachable | 3 | **3** ✅ |
| missing practice | 17 | **17** ✅ |
| missing principle | 5 | **5** ✅ |
| units | 20 | **20** ✅ |
| capabilities / taught | 11 / 9 | **11 / 9 of 11** ✅ |
| mapped assets (`proves`) | 12 | **12** ✅ |
| students | 0 | **0** ✅ |
| graph | valid | **valid — acyclic, all references resolve** ✅ |
| research | 3 studies not teachable | **3** ✅ (COR-001/COR-003 unchanged) |

`curriculum` reports `20 units · 3 teachable`; `gaps` reports `Missing PRINCIPLE (5)` and `Missing PRACTICE (17)`.

**The only output that changed is the `needed:` line of `university.mjs lab <id>` for the 17 units without Practice** — which is the intended effect and nothing more. No metric is derived from that string.

---

## G. Governance classification

`classifyChange()`, run read-only as a pure function:

```
corrected: true      -> PATCH   "correction with no change in what is assessed"
                                requires: curriculum_owner_approval
no governed input    -> NONE    "no governed change detected"
```

**`patch` is the honest classification** — the corrected string describes a contract that already existed since W5a; nothing about what is assessed changed.

`governance.json` sha `f0462e13b6eb094d6d31950065f3ea0d` — **unchanged**. `curriculum_version` **1.0.0** — unchanged. No approval entry created. A patch bump would be `1.0.1`; **not applied**.

---

## H. Integrity

```
files changed : 2
  lib/university/engine/assessment.mjs                  +1 −1   (this work)
  app/api/scam-intel/quick-check/route.ts               pre-existing, NOT touched

content/ 0 diffs · components/ 0 · scripts/ 0 · eval/ 0
lib/ diff limited to assessment.mjs alone
curriculum.mjs sha ea42cccc4d90a16806df462392c15903 — findPractice() untouched
governance.json unchanged · curriculum_version 1.0.0 · state/ absent · worktrees 1
staged 0 · HEAD f3136ee · sync 0/0 · commits made 0
```

Untouched as required: the Practice matcher, curriculum data files, all 20 incidents, all 7 labs, `governance.json`, `curriculum_version`, certification code (`certify`, `evaluateCertification`, `evaluateGraduation`, `integrityCheck`), and `route.ts`.

---

## I. Additional stale occurrences discovered — recorded, NOT fixed

Found during the repository-wide search. **None was modified.** All concern a **different subsystem** — content-recommendation and knowledge-graph inference (`lib/related-content.ts`), not the University Practice matcher — so none is affected by W5a.

| File | Line | Text |
|---|---|---|
| `content/docs/platform-maturity-audit-2026-05.mdx` | 208 | *"fall back to lessons that share 2+ tags with the current lesson"* |
| `content/docs/platform-maturity-audit-2026-05.mdx` | 163, 239 | tag-based fallback proposed as a P2 item |
| `content/docs/knowledge-graph-architecture.mdx` | 415-419 | *"Two content items sharing 3+ tags have a high probability of relevance"* |
| `content/docs/operational-memory-architecture.mdx` | 61, 152-154, 244, 270-272 | *"Two entities sharing 3+ tags have an inferred `related-to` relationship"*; tag-based inheritance |
| `content/docs/failure-memory-architecture.mdx` | 57, 302 | pattern grouping *"by tag intersection"* |

Two observations worth recording without acting on them:

1. **These are architecture proposals, not claims about the Practice beat.** They describe a *recommendation* fallback that may or may not be implemented; they do not misstate how labs match incidents.
2. **They are nonetheless in tension with the W5a finding.** W5a measured tag overlap producing four false positives out of five matches in this corpus. Any future implementation of tag-based inference in the recommendation layer would be building on a heuristic this repository has already measured and rejected elsewhere. **That is a separate decision, on separate evidence, and is not proposed here.**

---

## J. What was not done

No change to `findPractice()` or any matcher. No curriculum data change. No incident modified. No lab added or removed. No `governance.json` or `curriculum_version` change. No certification code touched. `route.ts` untouched. No other stale guidance rewritten. No worktree, staging, commit, push or deployment.

**Working-tree change: `assessment.mjs` (+1 −1) and this report.**
