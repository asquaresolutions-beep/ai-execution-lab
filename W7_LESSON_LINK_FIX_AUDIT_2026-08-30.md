# W7 Item 1 — Broken Lesson Link Correction

**Date:** 2026-08-30 · **HEAD:** `c06336500ee51c0f45cd0a9db328a1ccc9cc9f98`
**Scope:** two case-study files, four URL prefixes. No wording, link-text, frontmatter, route, curriculum-data, engine, tag, entity, blockJS, lab or governance change. `route.ts` untouched. Nothing staged, committed, pushed or deployed.

---

## 1. Pre-state

```
HEAD / origin/master : c06336500ee51c0f45cd0a9db328a1ccc9cc9f98  identical, ahead/behind 0/0
staged               : 0        worktrees : 1        state/ : absent
tracked modifications: app/api/scam-intel/quick-check/route.ts  (pre-existing)
untracked            : 128

content/case-studies/scamcheck-architecture-build.mdx   b97e44d837744254f5ff4345ec19b666
content/case-studies/trustseal-architecture-build.mdx   22ae8d4a450b4b3d024bc504063f9542
governance.json      : f0462e13b6eb094d6d31950065f3ea0d   v1.0.0   approved_by "pending"

METRICS  units 20 · teachable 3 · taught 9/11 · missing principle 5 · missing practice 17
         reproduces 3 · proves 12 · labs 7 · graph valid
```

---

## 2. Original broken URLs → corrected URLs

Both occurrences in each file sit in a `## Related` list — the exact learner-facing dead end.

| # | File : line | Original (404) | Corrected (200) |
|---|---|---|---|
| 1 | `scamcheck-architecture-build.mdx:311` | `/lessons/ai-business-zero-budget/zero-budget-stack/github-for-non-developers` | `/tracks/…/github-for-non-developers` |
| 2 | `scamcheck-architecture-build.mdx:312` | `/lessons/ai-business-zero-budget/zero-budget-stack/free-tier-architecture` | `/tracks/…/free-tier-architecture` |
| 3 | `trustseal-architecture-build.mdx:238` | `/lessons/claude-code-operator/vercel-deployment/deployment-pipeline` | `/tracks/…/deployment-pipeline` |
| 4 | `trustseal-architecture-build.mdx:239` | `/lessons/claude-code-operator/wordpress-rest-api/wp-auth-patterns` | `/tracks/…/wp-auth-patterns` |

Each was verified **LIVE** (not inside a code fence) before editing. Each file contained exactly **2** `/lessons/` occurrences; both were links, and both were corrected.

---

## 3. Production evidence

Measured before the edit, read-only:

```
/lessons/ai-business-zero-budget/zero-budget-stack/github-for-non-developers   404   /tracks/… 200
/lessons/ai-business-zero-budget/zero-budget-stack/free-tier-architecture      404   /tracks/… 200
/lessons/claude-code-operator/vercel-deployment/deployment-pipeline            404   /tracks/… 200
/lessons/claude-code-operator/wordpress-rest-api/wp-auth-patterns              404   /tracks/… 200
```

**Why `/lessons/` is wrong and `/tracks/` is right:**

- `app/lessons` **does not exist**; there are **0** `href="/lessons/` references in `app/` or `components/`. The prefix matches no route and never did.
- All four target MDX files exist under `content/lessons/…` and are **PRERENDERED** at `/tracks/…` — confirmed in the post-edit prerender manifest.
- `/tracks/…` is the established convention: **10** distinct `/tracks/<track>/<module>/<lesson>` links already exist across `content/`, including `/tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture` — the correct form of one of the very URLs being fixed.

`content/lessons/` is the **filesystem** path; `/tracks/…` is the **URL**. The four links conflated the two.

---

## 4. Exact two files changed

```
content/case-studies/scamcheck-architecture-build.mdx    +2 −2
content/case-studies/trustseal-architecture-build.mdx    +2 −2
                                                  total  +4 −4
```

Nothing else in the repository was modified by this work. The only other entry in `git status` is the pre-existing `route.ts`.

---

## 5. Exact diff

```diff
--- a/content/case-studies/scamcheck-architecture-build.mdx
+++ b/content/case-studies/scamcheck-architecture-build.mdx
@@ -308,5 +308,5 @@
 ## Related
 
 - [TrustSeal: Building an AI Website Trust Verifier](/case-studies/trustseal-architecture-build)
-- [GitHub for Non-Developers](/lessons/ai-business-zero-budget/zero-budget-stack/github-for-non-developers)
-- [Free Tier Architecture](/lessons/ai-business-zero-budget/zero-budget-stack/free-tier-architecture)
+- [GitHub for Non-Developers](/tracks/ai-business-zero-budget/zero-budget-stack/github-for-non-developers)
+- [Free Tier Architecture](/tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture)

--- a/content/case-studies/trustseal-architecture-build.mdx
+++ b/content/case-studies/trustseal-architecture-build.mdx
@@ -235,5 +235,5 @@
 ## Related
 
 - [ScamCheck: Building an AI Scam Detector](/case-studies/scamcheck-architecture-build)
-- [Vercel Deployment Pipeline](/lessons/claude-code-operator/vercel-deployment/deployment-pipeline)
-- [Firebase Auth Patterns](/lessons/claude-code-operator/wordpress-rest-api/wp-auth-patterns)
+- [Vercel Deployment Pipeline](/tracks/claude-code-operator/vercel-deployment/deployment-pipeline)
+- [Firebase Auth Patterns](/tracks/claude-code-operator/wordpress-rest-api/wp-auth-patterns)
```

**Mechanically verified:** each of the four changed lines is **identical apart from `/lessons/` → `/tracks/`**. Normalising both sides' prefix to a common token makes old and new byte-equal on all four. **No link text changed, no wording changed, no list reordered.**

*Method note:* two of my own shell checks initially misreported this diff — the removed lines begin `-- [` (a markdown `- [` behind the diff's `-`), so patterns like `^-[^-]` matched nothing and reported "0 deletions". `git diff --numstat` is authoritative at **+4/−4**, and the corrected per-line comparison above confirms equivalence. Recording this so the earlier console output is not mistaken for evidence.

---

## 6. Gates

| Gate | Result |
|---|---|
| `git diff --check` | **clean** — no whitespace errors |
| `tsc --noEmit` | **exit 0** |
| scam-intel suite | **30/30 pass**, 0 fail |
| `next build` | **exit 0** — `✓ Compiled successfully in 47s` |
| Page count | **1033 / 1033** |
| `status` · `gaps` · `curriculum` · `graph` · `research` | all unchanged |

**No new routes.** The commit adds no `app/` file, and all four targets were already prerendered before the change:

```
PRERENDERED  /tracks/ai-business-zero-budget/zero-budget-stack/github-for-non-developers
PRERENDERED  /tracks/ai-business-zero-budget/zero-budget-stack/free-tier-architecture
PRERENDERED  /tracks/claude-code-operator/vercel-deployment/deployment-pipeline
PRERENDERED  /tracks/claude-code-operator/wordpress-rest-api/wp-auth-patterns
total prerendered routes: 1026
```

---

## 7. Metric invariance

| Metric | Required | Observed |
|---|---|---|
| build | 1033/1033 | **1033/1033** ✅ |
| units | 20 | **20** ✅ |
| teachable | 3 | **3** ✅ |
| taught | 9/11 | **9 of 11** ✅ |
| missing practice | 17 | **17** ✅ |
| missing principle | 5 | **5** ✅ |
| reproduces | 3 | **3** ✅ |
| proves | 12 | **12** ✅ |
| labs | 7 | **7** ✅ |
| graph | valid | **valid — acyclic, all references resolve** ✅ |
| research | 3 not teachable | **3** ✅ |
| `curriculum_version` | 1.0.0 | **1.0.0** ✅ |
| governance.json | untouched | **sha f0462e13… unchanged** ✅ |

Neither case study is an incident, so no unit's beats are affected. **Case studies are not part of the University corpus's unit construction** — the metrics could not have moved, and did not.

---

## 8. Governance classification

`classifyChange({ corrected: true })` → **`patch`** — *"correction with no change in what is assessed"*, `curriculum_owner_approval`, notice `false`.

**`patch` is the ceiling, and arguably generous.** Case studies contribute no unit, beat, capability or relationship; nothing assessed changed. `governance.json` was **not modified** and `curriculum_version` was **not bumped**.

---

## 9. Exclusions verified

| Excluded | Verified |
|---|---|
| Wording / link text | **unchanged** — all 4 lines byte-equal apart from the prefix |
| Frontmatter | **0** frontmatter lines in the diff |
| Content restructuring | none — same lines, same order, same list |
| Routes / `app/` | **0** app files changed |
| `route.ts` | ` M` pre-existing, untouched, unstaged |
| Curriculum data (`lib/university/data`) | **0** diffs |
| University engine | **0** diffs |
| Tags / entities | **0** diffs |
| blockJS / `content-renderer.tsx` | **0** diffs |
| New lab | none — labs still **7** |
| Governance / version | sha unchanged, 1.0.0 |
| W7 discovery report | **not modified** |
| **Other `/lessons/` references** | **9 files still contain `/lessons/`, all unmodified** — they are `content/lessons/…` filesystem paths in docs and templates, plus two fenced examples. Correctly left alone. |

The nine untouched files: `docs/content-templates`, `docs/execution-checklist-system`, `docs/execution-observability-design`, `docs/geo-intelligence-architecture`, `docs/platform-maturity-audit-2026-05`, `docs/publishing-operations`, `failures/gsc-index-coverage-drop`, `_templates/lesson.mdx`, `_templates/README.md`.

---

## 10. Repository integrity

```
HEAD / origin/master : c063365…  identical, ahead/behind 0/0     commits made : 0
staged               : 0        worktrees : 1        state/ : absent
tracked modifications: content/case-studies/scamcheck-architecture-build.mdx   (+2 −2)
                       content/case-studies/trustseal-architecture-build.mdx   (+2 −2)
                       app/api/scam-intel/quick-check/route.ts                 (pre-existing)
remaining /lessons/ in the two edited files : 0
governance.json      : f0462e13b6eb094d6d31950065f3ea0d — unchanged
curriculum_version   : 1.0.0 — unchanged      approved_by : "pending" — unchanged
```

**Working-tree change: the two case-study files and this report.**

### Post-fix production note

The corrected `/tracks/…` URLs already return **200** today — they were verified before the edit. The four `/lessons/…` URLs will continue to 404 until this change is deployed, which is correct: they are not real routes and should not resolve. **Nothing about production has changed yet**; this fix is not deployed.

### What was not done

No staging, commit, push or deployment. No route change. No curriculum data, engine, tag, entity or blockJS change. No lab. No governance or version change. W7 Item 2 not started — there is no W7 Item 2.
