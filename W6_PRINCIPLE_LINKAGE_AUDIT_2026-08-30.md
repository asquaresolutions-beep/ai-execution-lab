# W6 Item 1 — Principle Linkage Audit

**Date:** 2026-08-30 · **HEAD at start:** `e613549a35950aa5b951f0fdbbed753d32a61337`
**Scope:** linkage only. No Principle theory authored. No engine, matcher, schema, competency, capability, lesson, lab, governance or `curriculum_version` change. `route.ts` untouched. Nothing staged, committed, pushed or deployed.

---

## Headline

**Two of the three proposed mappings were implemented. One was rejected on the mechanism test.**

`missing principle: 7 → 5` — **not the 7 → 4 the brief anticipated**, because `ga4-preview-environment-contamination → analytics-setup` failed full-document verification and was left untouched, exactly as the hard stop requires.

---

## 1. Snapshot

```
HEAD / origin        : e613549a35950aa5b951f0fdbbed753d32a61337  identical, ahead/behind 0/0
staged               : 0        worktrees : 1        state/ : absent
tracked modifications: app/api/scam-intel/quick-check/route.ts  (pre-existing)
untracked            : 123      porcelain : 124
```

Anchor hashes before the change:

| File | sha256 (first 32) |
|---|---|
| `failures/vite-github-pages-spa-routing.mdx` | `3b5df5cb54d626db88380ee568c11375` |
| `failures/gemini-rate-limit-429-no-ux.mdx` | `9b6b43de077c8e2be00cbc0874ea7432` |
| `failures/ga4-preview-environment-contamination.mdx` | `1f6795118eedf54321b5ce9227b20350` |
| `docs/github-pages-spa-deployment.mdx` | `b7eb71ef620251ae111caf08efa6dd74` |
| `docs/gemini-production-operations.mdx` | `30368e1e5d49da23155a1e49265a3da9` |
| `docs/analytics-setup.mdx` | `7dca4ca59e7c9282870bfd63bac56c89` |
| `lib/university/engine/curriculum.mjs` | `ea42cccc4d90a16806df462392c15903` |

---

## 2. Relationship convention (verified before editing)

`findPrinciple()` — `curriculum.mjs:110`:

```js
function findPrinciple(incident, docs) {
  const refs = incident.fm.related_docs ?? []
  if (refs.length) {
    const hit = docs.find(d => refs.includes(d.slug))
    if (hit) return { doc: hit, via: 'related_docs' }
  }
  return null
}
```

**The incident owns the relationship.** It is resolved by doc *slug*, and `slug = filename without .mdx` (`corpus.mjs:64`). The Principle documents are never read for this purpose and were not touched.

Corpus usage confirms `related_docs` is the established field, not an invention:

```
incidents using related_docs     : 15 / 20
incidents using linked_incidents : 16 / 20
incidents using related_failures :  8 / 20
docs using related_docs          : 38 / 116
```

Field ordering follows the corpus convention (`edge-runtime-deployment-failure.mdx`): `related_failures` → `related_case_studies` → **`related_docs`** → `linked_incidents`.

---

## 3. Three proposed mappings

| # | Incident | Proposed Principle doc | Verdict |
|---|---|---|---|
| 1 | `vite-github-pages-spa-routing` | `docs/github-pages-spa-deployment` | ✅ **ACCEPTED** |
| 2 | `gemini-rate-limit-429-no-ux` | `docs/gemini-production-operations` | ✅ **ACCEPTED** |
| 3 | `ga4-preview-environment-contamination` | `docs/analytics-setup` | ❌ **REJECTED** |

All six documents were read in full — 175, 287, 192, 347, 151 and 163 lines respectively. No verdict rests on keyword counts.

---

## 4. Full-document mechanism verification

### Mapping 1 — ACCEPTED · confidence HIGH

| | |
|---|---|
| **Incident mechanism** | *"GitHub Pages does not have a server that can rewrite URLs. When a request comes in for `/dashboard`, GitHub Pages looks for `/dashboard/index.html` or `/dashboard`. Neither exists."* (incident §The Root Cause) |
| **Doc mechanism** | *"GitHub Pages returns its own 404 page when a requested path does not exist as a file. For a SPA at `/dashboard`, there is no `dashboard/index.html` — the SPA handles this route in JavaScript."* (doc §The 404.html SPA Routing Redirect) |
| **Mechanism identity** | **Same causal chain, same worked example path, same resolution hook.** The doc generalises it into a reusable pattern with a Failure Modes table, the `public/` copy rule, and the `base: '/'` rule — the incident's "Secondary Issue: Vite Base Path" appears in the doc as a general rule. |
| **Why legitimate, beyond keywords** | The doc **already declares `related_failures: [vite-github-pages-spa-routing]`** at line 10. The author asserted this relationship from the doc side; only the reciprocal incident-side link — the one `findPrinciple()` reads — was missing. This is linkage recovery, not a new claim. |

### Mapping 2 — ACCEPTED · confidence HIGH

| | |
|---|---|
| **Incident mechanism** | *"The Gemini free tier enforces a requests-per-minute limit… the Cloud Function was not handling the 429 — it propagated the error as an unhandled exception, which the client interpreted as a generic failure and left the spinner running indefinitely."* |
| **Doc mechanism** | §Rate Limit Handling (429): *"Gemini free tier enforces a requests-per-minute (RPM) limit. When the limit is hit, Gemini returns HTTP 429. Without explicit handling, the Cloud Function crashes and the client shows an indefinite spinner."* |
| **Mechanism identity** | **The doc restates the incident's causal chain verbatim in substance, then abstracts it into a stated rule** — doc line 194: *"**Key principle:** Return structured response objects (HTTP 200) for expected error conditions (rate limits, parse failures). Only throw unhandled exceptions for unexpected errors."* That is precisely the generalisable rule the Principle beat exists to hold. |
| **Why legitimate, beyond keywords** | The doc links the incident directly at line 141 and declares `related_failures: [gemini-rate-limit-429-no-ux]` at line 10. Same reciprocal-gap situation as mapping 1. |

### Mapping 3 — REJECTED · the mechanism is absent

| | |
|---|---|
| **Incident mechanism** | `NEXT_PUBLIC_` variables are **inlined at build time**, and the **Vercel environment scope** (Production / Preview / Development) determines which builds receive the value. An all-environments scope bakes the production GA4 measurement ID into preview builds, so preview pageviews fire to the production property and contaminate it irrecoverably. |
| **What `analytics-setup.mdx` actually contains** | A provider activation how-to: create a Plausible account, create a GA4 property, paste an env var, redeploy; a Vercel Analytics option; a Web Vitals section; a launch checklist. |
| **Mechanism present?** | **No.** Verified across the full document: **zero** occurrences of `preview`, `scope`, or `inlin`. The doc never mentions environment scope, build-time inlining, preview deployments, or data contamination. |
| **What the W6 discovery keyword count actually matched** | The 13 hits for `preview\|staging\|environment\|vercel` resolve on reading to *"Vercel project settings → Environment Variables"* (setup steps), *"Vercel Analytics"* (a provider option), and *"active in all environments"* (Web Vitals). **Pure keyword collision.** |
| **Independent disqualifier** | The two documents describe **different variables**: the incident is about `NEXT_PUBLIC_GA_MEASUREMENT_ID`; the doc instructs setting `NEXT_PUBLIC_GA_ID`. |
| **Actively misleading if linked** | The doc's only environment claim — *"Neither fires in `NODE_ENV=development` — local dev is always clean"* (line 23) — concerns **local development**. The failure occurred in **deployed Vercel preview builds**, where `NODE_ENV` is `production`. A reader following this as the incident's Principle would draw a false assurance. |

**This is the W5a standard doing its job.** W5a found tag overlap produced four false positives out of five matches; W6 discovery flagged this candidate on keyword density; reading the full document disproved it. No link was created and neither file was modified.

---

## 5. Exact implementation diff

Two files, **+4 / −1**.

```diff
--- a/content/failures/vite-github-pages-spa-routing.mdx
+++ b/content/failures/vite-github-pages-spa-routing.mdx
@@ -26,6 +26,8 @@ related_failures:
  related_case_studies:
    - trustseal-architecture-build
    - scamcheck-architecture-build
+related_docs:
+  - github-pages-spa-deployment
 linked_incidents:
   - dns-subdomain-propagation-delay
```

```diff
--- a/content/failures/gemini-rate-limit-429-no-ux.mdx
+++ b/content/failures/gemini-rate-limit-429-no-ux.mdx
@@ -24,7 +24,8 @@ related_case_studies:
 related_logs:
   - 2026-05-18-scamcheck-operations-review
-related_docs: []
+related_docs:
+  - gemini-production-operations
 evidence_images: []
```

The second edit populates an **already-existing empty array** — the field was declared and left unfilled. No new field was invented in either file. No Principle document was modified.

---

## 6. Before / after metrics

| Metric | Before | After | Expected | Result |
|---|---|---|---|---|
| **missing principle** | 7 | **5** | 4 | ⚠ **differs — one mapping rejected** |
| units | 20 | **20** | 20 | ✅ |
| competencies | 6 | **6** | 6 | ✅ |
| capabilities | 11 | **11** | 11 | ✅ |
| taught | 9/11 | **9 of 11** | 9/11 | ✅ |
| teachable | 3 | **3** | 3 | ✅ |
| missing practice | 17 | **17** | 17 | ✅ |
| mapped assets | 12 | **12** | 12 | ✅ |
| unknown refs | 0 | **0** | 0 | ✅ |
| students | 0 | **0** | 0 | ✅ |
| graph | valid | **valid** | valid | ✅ |
| Practice relationships | 3 | **3** | 3 | ✅ |

The single deviation is the intended consequence of the hard stop. **7 → 4 was only reachable by creating a link the evidence does not support.**

### Beat changes — exactly three units affected, two of them intentionally

```
vite-github-pages-spa-routing          1/4 -> 2/4
  [OK  ] incident   content/failures/vite-github-pages-spa-routing.mdx
  [OK  ] principle  content/docs/github-pages-spa-deployment.mdx     <- new
  [FAIL] practice   no lab declares it reproduces this incident
  [FAIL] proof      project engine

gemini-rate-limit-429-no-ux            1/4 -> 2/4
  [OK  ] incident   content/failures/gemini-rate-limit-429-no-ux.mdx
  [OK  ] principle  content/docs/gemini-production-operations.mdx    <- new
  [FAIL] practice   no lab declares it reproduces this incident
  [FAIL] proof      project engine

ga4-preview-environment-contamination  1/4 -> 1/4   UNCHANGED
  [OK  ] incident   content/failures/ga4-preview-environment-contamination.mdx
  [FAIL] principle  no principle document linked                     <- deliberately still absent
```

Remaining missing-Principle units (5): `dns-subdomain-propagation-delay`, `firebase-auth-domain-not-authorized`, `firebase-functions-node-version-stability`, **`ga4-preview-environment-contamination`**, `litespeed-client-cache-bypass-ignored`.

Neither newly-linked unit became `teachable` — `teachable` is `incident && practice`, and Practice is untouched. **This change moves no unit toward teachable, and was not undertaken to.**

---

## 7. Governance classification

`classifyChange({ corrected: true })`, run read-only as a pure function:

```
class    : PATCH
why      : correction with no change in what is assessed
requires : curriculum_owner_approval
notice   : false
```

Matches the brief's expectation. Nothing about *what is assessed* changed — two incidents now resolve a Principle document that already existed and already pointed back at them.

**`governance.json` was not modified** (hash `f0462e13b6eb094d6d31950065f3ea0d`) and **`curriculum_version` remains `1.0.0`**. No approval entry created. A `patch` bump would be `1.0.1` if later approved; **not applied.**

---

## 8. Regression results

### W5a regression — Practice matching intact

```js
function findPractice(incident, labs) {
  const hit = labs.find(l => (l.fm.reproduces ?? []).includes(incident.slug))
  return hit ? { doc: hit, via: 'reproduces' } : null
}
```

Tag references inside `findPractice`: **0**. No tag-based fallback has returned.

The three `reproduces` declarations, unchanged and exact:

```
edge-runtime-deployment-reproduction.mdx      -> edge-runtime-deployment-failure
gemini-structured-output-reliability.mdx      -> gemini-json-parse-failure
server-module-client-bundle-reproduction.mdx  -> server-module-client-bundle
```

### Gate set

| Gate | Result |
|---|---|
| `tsc --noEmit` | **exit 0**, no diagnostics |
| scam-intel suite | **30/30 pass**, 0 fail |
| `status` | all metrics as tabled above |
| `gaps` | missing principle 5, missing practice 17, no UNKNOWN section |
| `curriculum` | 20 units · 3 teachable |
| `graph` | **valid — acyclic, all references resolve** |
| `research` | unchanged — all 3 studies `NO`; COR-001 and COR-003 still blocking |
| `unit` (×3) | beats as tabled |
| `project` | unchanged — driven by `teachable`, which did not move |
| integrity | `curriculum_version` 1.0.0, approval still pending (pre-existing) |

*Note on the test invocation:* `node --test lib/scam-intel/` fails with `MODULE_NOT_FOUND` — the runner resolves a bare directory as a module. Passing the two files explicitly runs the suite correctly: **30/30**. This is an invocation detail, not a regression.

---

## 9. Build result

```
✓ Compiled successfully in 38.0s
✓ Generating static pages (1033/1033)
BUILD_EXIT = 0
```

**1033 pages — identical to the pre-change baseline.** No new routes. Expected: `related_docs` is frontmatter consumed by the University engine and the related-content renderer; it creates no route.

---

## 10. Integrity verification

```
files changed anywhere : 3
  app/api/scam-intel/quick-check/route.ts   (pre-existing, NOT touched by this work)
  content/failures/gemini-rate-limit-429-no-ux.mdx        +2 -1
  content/failures/vite-github-pages-spa-routing.mdx      +2 -0
```

Hashes confirming the untouched surfaces:

| File | After | Matches before |
|---|---|---|
| `failures/ga4-preview-environment-contamination.mdx` | `1f6795118eedf54321b5ce9227b20350` | ✅ |
| `docs/analytics-setup.mdx` | `7dca4ca59e7c9282870bfd63bac56c89` | ✅ |
| `docs/github-pages-spa-deployment.mdx` | `b7eb71ef620251ae111caf08efa6dd74` | ✅ |
| `docs/gemini-production-operations.mdx` | `30368e1e5d49da23155a1e49265a3da9` | ✅ |
| `lib/university/engine/curriculum.mjs` | `ea42cccc4d90a16806df462392c15903` | ✅ |
| `lib/university/data/governance.json` | `f0462e13b6eb094d6d31950065f3ea0d` | ✅ |

```
staged : 0     worktrees : 1     state/ : absent
HEAD / origin : e613549… / e613549…, ahead/behind 0/0     commits made : 0
```

---

## 11. Explicitly untouched surfaces

Engine (`curriculum.mjs`, `corpus.mjs`, `graph.mjs`, `progress.mjs`, `assessment.mjs`, `governance.mjs`, `research.mjs`, `university.mjs`) · `findPractice()` and all Practice matching · the 3 `reproduces` declarations · schema and frontmatter field set · `competencies.json`, `capabilities.json`, `certification.json`, `rubric.json`, `rules.json`, `governance.json` · `curriculum_version` · `lib/tracks.ts` and all 12 `proves` mappings · every lesson · every lab · 18 of 20 incidents · **all three Principle documents, including both accepted targets** · `app/api/scam-intel/quick-check/route.ts` · deployment configuration · W6 items 2–5.

---

## 12. Rejected mapping

**`ga4-preview-environment-contamination → analytics-setup` — rejected, both files untouched.**

Full reasoning in §4. In one line: the target is a provider-activation how-to that never mentions environment scope, build-time inlining, or preview deployments, names a different variable, and contains a `NODE_ENV=development` claim that would mislead a reader about a failure which occurred in production-mode preview builds.

**This unit still needs a genuine Principle**, and W6 discovery already classified the remaining four as *genuine missing Principle* rather than missing linkage. Writing one is Principle authoring — explicitly out of scope here and requiring separate approval.

Worth recording for whoever takes it: the incident already contains the generalisable rule internally, in its §*Analytics-Specific Environment Variable Rule* table (which correctly generalises to Sentry DSNs, feature-flag keys, and ordinary API keys). Extracting that into a standalone doc would be the smallest honest path — **but it is authoring, not linking, and it was not done.**

---

## 13. Recommendation for commit

**Ready for separate commit approval.**

Suggested scope — exactly two files:

```
content/failures/vite-github-pages-spa-routing.mdx
content/failures/gemini-rate-limit-429-no-ux.mdx
```

Plus, at your discretion and as a separate decision, this report and the two uncommitted W6 audit reports.

**Must not be included:** `app/api/scam-intel/quick-check/route.ts`.

Governance class **`patch`** — `curriculum_owner_approval`, no notice required, no effect on issued certificates (there are none). If a version bump is wanted it would be `1.0.0 → 1.0.1`; **not applied here**, and worth noting the initial `1.0.0` approval is itself still `pending`.

**Nothing was committed, staged, pushed or deployed.**

---

## 14. What was not done

No Principle theory authored. No third link created. No document rewritten. No engine, matcher, schema, governance or `curriculum_version` change. No Practice relationship altered. No lesson, lab or capability touched. `route.ts` untouched. No worktree. No staging, commit, push or deployment. W6 items 2–5 not started.

**Working-tree change: the two frontmatter edits and this report.**
