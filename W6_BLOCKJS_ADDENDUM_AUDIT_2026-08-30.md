# W6 Item 5 — blockJS Incident Dated Addendum

**Date:** 2026-08-30 · **HEAD:** `3ec20564785d375e85be1bd5589ffcd4a6bb05e3`
**Scope:** one file, additive only. No implementation change, no consumer hardening, no Lab C, no curriculum relationship, no `governance.json` or `curriculum_version` change, no new tags, no deployment experiment. `route.ts` untouched. Nothing staged, committed, pushed or deployed.

---

## 1. Pre-state

```
HEAD / origin/master : 3ec20564785d375e85be1bd5589ffcd4a6bb05e3  identical, ahead/behind 0/0
staged               : 0        worktrees : 1        state/ : absent
tracked modifications: app/api/scam-intel/quick-check/route.ts  (pre-existing)
untracked            : 127

blockJS incident SHA : 13f5563a730ae3ed7d5cd9d162f200d3   302 lines · 2,487 words
governance.json SHA  : f0462e13b6eb094d6d31950065f3ea0d
curriculum_version   : 1.0.0        approved_by : "pending"

METRICS  units 20 · teachable 3 · missing principle 5 · missing practice 17
         capabilities 11 · taught 9/11 · proves 12 · reproduces 3 · labs 7
         students 0 · graph valid
```

Source reports read in full before editing: `W5B_REPRODUCTION_LAB_AUDIT_2026-08-28.md` (299 lines), `W5B_NEXT_MDX_REMOTE_BLOCKJS_EMPIRICAL_2026-08-29.md` (259), `W5B_NEXT_MDX_REMOTE_BLOCKJS_EMPIRICAL_BIS_2026-08-29.md` (229), `W6_REMAINING_INTEGRITY_AUDIT_2026-08-30.md` (315), `W6_CLOSEOUT_2026-08-30.md` (223), and the incident itself.

---

## 2. Location and convention chosen

The incident's structure was inspected before choosing a location:

```
frontmatter (lines 1-31)  — 22 keys
## What Happened (83) · ## The v6 Change (93) · ## Debugging Path (109)
## Execution Evidence (149) · ## Why Silent Failures Are Worse (219)
## Recovery Timeline (240) · ## Lessons Learned (265) · ## Prevention Pattern (293)
                                                        ← file ends at 302
```

**Smallest additive location: a new final `##` section appended after `Prevention Pattern`.** This was chosen because it:

- adds **nothing** to frontmatter — no new tag, no metadata edit, no `time_to_detect` change
- introduces **no MDX component** — plain markdown, one fenced code block, one table, so no new expression props and no new consumer dependency
- leaves every existing heading, paragraph and `<Callout>` byte-identical
- follows the document's own convention (`##` sections, `---` separators)

---

## 3. Exact edit

```
numstat: 52 insertions, 0 deletions
```

**Zero deletions. The edit is purely additive** — no existing line was rewritten, reordered or removed.

| | Before | After |
|---|---|---|
| SHA | `13f5563a730ae3ed7d5cd9d162f200d3` | `0b52c75ab42fac78a864e686c31db7a9` |
| Lines | 302 | 354 |
| Frontmatter lines changed | — | **0** |

Frontmatter claims preserved verbatim, including the two the addendum discusses:

```
tags: ["next-mdx-remote", "mdx", "jsx", "upgrade", "vercel", "dependency"]
time_to_detect: "Manual visual inspection post-deploy — build succeeded"
```

**`time_to_detect` was deliberately left unchanged.** It is the historical record; the addendum reports the divergence rather than editing the claim.

### The added section

`## Addendum — 2026-08-30: re-validation in the current tree`, containing:

1. An explicit preservation statement — *"Everything above is the May 2026 record and stands unchanged. This section is additive."*
2. Verification dates: **2026-08-29** (controlled experiment at `8c01c07`) and **2026-08-30** (read-only structural audit).
3. What was re-tested: one mutation, `blockJS: false → true`, with a passing baseline first.
4. A four-row comparison table separating **mechanism (confirmed)** from **signature (not confirmed)**.
5. The verbatim observed output, including `TypeError: Cannot read properties of undefined (reading 'map')`, the compile-then-export sequence, and `exit 1`.
6. The structural explanation — 8 unguarded `.map()` call sites across 6 component files, reached by 73 of 99 expression-carrying content files — with an explicit statement that **the May 2026 guard state is not established**.
7. Scope and limits: hard stop honoured, no second mutation, **no correction asserted**, `blockJS: false` remains correct, and re-validation may be needed if consumers or routing change.

---

## 4. Evidence basis — every factual claim traced

| Claim in the addendum | Source |
|---|---|
| Verified 2026-08-29, worktree at `8c01c07` | `EMPIRICAL:3` — *"**Date:** 2026-08-29 · **HEAD:** `8c01c07…`"* |
| Baseline exit 0, 1033/1033 with items rendering | `EMPIRICAL` §4 rendered-output baseline |
| Props arrive `undefined` — mechanism confirmed | `EMPIRICAL:17` — *"Props inside components \| `undefined` \| **`undefined`** ✅"* |
| Compilation succeeds — `✓ Compiled successfully in 18.5s` | `EMPIRICAL:116`, and `:175` *"Compilation did succeed"* |
| `TypeError: Cannot read properties of undefined (reading 'map')` | `EMPIRICAL:119` |
| Export error, `exit 1` | `EMPIRICAL:120,123` |
| Build outcome differs: succeeds/ships → fails, exit 1 | `EMPIRICAL:18` |
| Caught by build refusal, not visual inspection | `EMPIRICAL:20` |
| No HTML emitted for affected pages | `EMPIRICAL` §6 rendered-output comparison |
| Unguarded `.map()` consumers cause the throw | `EMPIRICAL:151` — *"All three call `.map()` **with no guard**"* |
| **8 sites across 6 files**, **73 of 99** content files | `W6_REMAINING:86,115` (corrected figures) |
| Failure has **changed class**, silent → loud | `BIS:150` |
| Historical guard state **not established** | `BIS:49` — *"Undetermined, and not determinable from this tree"* |
| Hard stop honoured; **no second mutation** | `EMPIRICAL:22,193` |
| **No correction asserted**; original account intact | `BIS:156,163` |
| A dated addendum is the correct form | `BIS:165` — *"the honest framing… is a **dated addendum**… not an edit to the historical record"* |
| `blockJS: false` swaps in the dangerous-calls plugin | `W6_REMAINING` §B — `serialize.js:12-23` |

**Nothing in the addendum is unsourced.**

### One reconciliation, recorded rather than hidden

The task instruction (rule 7) asked to record that *"current consumers behind the global ContentRenderer have changed"*. Rules 3 and 8 forbid inventing or claiming the historical guard state — and `BIS:49` records it as **undetermined and not determinable from this tree**.

**These were reconciled by asserting only what is established.** The addendum states that the current tree *contains* unguarded consumers and that this explains today's loud failure, then says explicitly:

> *"What the guard state of those components was in May 2026 is not established here. Determining it is a question for the file history, not for this experiment, and no claim is made about it."*

This delivers the structural explanation rule 7 asks for without violating rules 3 and 8. **The word "changed" is deliberately not used about the consumers themselves** — only about the failure *class*, which is directly observed.

---

## 5. Gates

| Gate | Result |
|---|---|
| `git diff --check` | **clean** — no whitespace errors |
| `tsc --noEmit` | **exit 0** |
| scam-intel suite | **30/30 pass**, 0 fail |
| `next build` | **exit 0** — `✓ Compiled successfully in 16.7s` |
| Page count | **1033 / 1033** — unchanged, no new routes |
| `status` / `gaps` / `curriculum` / `graph` / `research` / `unit` | all unchanged |

The unit itself, after the edit:

```
next-mdx-remote-v6-blockjs   competency: building
  [OK  ] incident   content/failures/next-mdx-remote-v6-blockjs.mdx
  [OK  ] principle  content/docs/failure-pattern-library.mdx
  [FAIL] practice   no lab declares it reproduces this incident
  [FAIL] proof      project engine
```

**2/4, exactly as before.** The addendum adds no beat and no relationship.

---

## 6. Metric invariance

| Metric | Pre | Post |
|---|---|---|
| units | 20 | **20** ✅ |
| teachable | 3 | **3** ✅ |
| missing principle | 5 | **5** ✅ |
| missing practice | 17 | **17** ✅ |
| capabilities | 11 | **11** ✅ |
| taught | 9/11 | **9 of 11** ✅ |
| mapped assets (`proves`) | 12 | **12** ✅ |
| `reproduces` relationships | 3 | **3** ✅ |
| labs | 7 | **7** ✅ |
| students | 0 | **0** ✅ |
| graph | valid | **valid** ✅ |
| research studies not teachable | 3 | **3** ✅ |

The three `reproduces` declarations, unchanged:

```
edge-runtime-deployment-reproduction.mdx      -> edge-runtime-deployment-failure
gemini-structured-output-reliability.mdx      -> gemini-json-parse-failure
server-module-client-bundle-reproduction.mdx  -> server-module-client-bundle
```

**No lab for the blockJS incident exists** — 0 files under `content/labs/` reference it. **Lab C was not created.**

---

## 7. Exclusions verified

| Excluded | Verified |
|---|---|
| Historical narrative rewritten/deleted | **0 deletions** in the diff |
| Frontmatter modified | **0** frontmatter lines changed |
| New tags | **0** — `tags:` byte-identical |
| `time_to_detect` corrected | **no** — preserved verbatim |
| blockJS implementation changed | `components/content-renderer.tsx` — 0 diffs |
| Consumers hardened | `components/` — **0** diffs |
| Lab C created | 0 labs reference the incident; labs still **7** |
| New curriculum relationship | `reproduces` 3, `related_docs` unchanged, `proves` 12 |
| `governance.json` / `curriculum_version` | sha `f0462e13…`, **1.0.0**, `approved_by: "pending"` — all unchanged |
| Other content files | **0** other files under `content/` changed |
| `lib/` or `components/` | **0** diffs |
| `route.ts` | ` M` pre-existing, **unstaged**, untouched |
| Deployment-oriented experiment | none run |

---

## 8. Governance classification

`classifyChange({ corrected: true })` → **`patch`** — *"correction with no change in what is assessed"*, requires `curriculum_owner_approval`, notice `false`.

Matches the W6 matrix's own classification of candidate 5. Nothing about what is assessed changed: the unit's beats, competency and metrics are identical.

`governance.json` was **not modified** and `curriculum_version` was **not bumped**. A patch bump would be `1.0.1`; **not applied**.

---

## 9. Post-state

```
HEAD / origin/master : 3ec2056…  identical, ahead/behind 0/0     commits made : 0
staged               : 0        worktrees : 1        state/ : absent
tracked modifications: content/failures/next-mdx-remote-v6-blockjs.mdx   (+52 −0, this work)
                       app/api/scam-intel/quick-check/route.ts           (pre-existing, untouched)
blockJS incident SHA : 0b52c75ab42fac78a864e686c31db7a9   354 lines
governance.json SHA  : f0462e13b6eb094d6d31950065f3ea0d — unchanged
curriculum_version   : 1.0.0        approved_by : "pending" — unchanged
```

**Working-tree change: the incident addendum and this report.**

### What was not done

No implementation change. No consumer hardening. No Lab C. No curriculum relationship added. No governance or version change. No new tag. No deployment experiment. No historical claim rewritten or withdrawn. No staging, commit, push or deployment.
