# W6 Item 4 — Soft-404 Fix Implementation

**Date:** 2026-08-30 · **HEAD at start:** `c3fa018ceb99688796ede3e7a06dfc997e6f2192`
**Scope:** 12 route files, one line each. No engine, curriculum, content, `lib/`, `components/`, middleware, `not-found.tsx`, layout, governance or state change. `route.ts` untouched and unstaged.

---

## 1. Snapshot

```
HEAD / origin        : c3fa018…  identical, ahead/behind 0/0
staged               : 0        worktrees : 1        state/ : absent
tracked modifications: app/api/scam-intel/quick-check/route.ts  (pre-existing, +5/−13)
untracked            : 124      porcelain : 125
```

Pre-change confirmations:

- **`dynamicParams` occurrences across the 12 targets: 0.**
- **Repository convention confirmed — 7 export sites**, not 8:
  `app/authors/[slug]`, `app/es/[checker]`, `app/hi/[checker]`, `app/scams/[[...slug]]`, `app/trustseal/[locale]/layout.tsx`, `app/trustseal/[locale]/legal/[doc]`, `app/[slug]`.
  *Correction to the discovery audit: its eighth item — `app/trustseal/[locale]/dashboard/page.tsx:5` — is a comment mentioning the convention, not an export.*
- **Deliberate open-set routes left alone:** `trustseal/[locale]/trust/[domain]:19` and `certificate/[domain]:14`, both `dynamicParams = true`.

Route hashes before the change:

```
failures/[slug]        97e2c3962436676678f43039    tags/[tag]                 ca7116a39bcf4743bc8bf253
labs/[slug]            7118e10474c0fb40a7e18dfb    pathways/[id]              8e21ab90aa1fb5c89c866cd7
docs/[slug]            2a9ed4df6c69e4ce069d95f6    scam-intelligence/[slug]   aa33523f8e7ff37e90aa391e
case-studies/[slug]    b90d2fcf0bd60adc031b3bf9    tracks/[track]             925ca714e579cb3c21c7241c
logs/[slug]            60d4c73e427048f65e6708f6    tracks/[track]/[module]/[lesson]  d224e6fc6223c86dc0e2a4f4
playbooks/[slug]       537e32f58e355be0ec521a6d
systems/[slug]         1b15b2463e982903f88fccdc
```

---

## 2. Exact 12-file diff

Every changed line in the repository, aggregated:

```
     12  +export const dynamicParams = false
```

**That is the entire change.** Twelve files, `+1 −0` each:

| File | Inserted at line | Now precedes |
|---|---|---|
| `app/failures/[slug]/page.tsx` | 13 | `export async function generateStaticParams()` |
| `app/labs/[slug]/page.tsx` | 10 | `export async function generateStaticParams()` |
| `app/docs/[slug]/page.tsx` | 10 | `export async function generateStaticParams()` |
| `app/case-studies/[slug]/page.tsx` | 11 | `export async function generateStaticParams()` |
| `app/logs/[slug]/page.tsx` | 11 | `export async function generateStaticParams()` |
| `app/playbooks/[slug]/page.tsx` | 13 | `export async function generateStaticParams()` |
| `app/systems/[slug]/page.tsx` | 10 | `export async function generateStaticParams()` |
| `app/tags/[tag]/page.tsx` | 80 | `export async function generateStaticParams()` |
| `app/pathways/[id]/page.tsx` | 15 | `export async function generateStaticParams()` |
| `app/scam-intelligence/[slug]/page.tsx` | 14 | `export function generateStaticParams(): { slug: string }[]` |
| `app/tracks/[track]/page.tsx` | 20 | `export function generateStaticParams()` |
| `app/tracks/[track]/[module]/[lesson]/page.tsx` | 33 | `export function generateStaticParams()` |

Placement matches the reference implementation exactly — `app/authors/[slug]/page.tsx:10` places the same export immediately above `generateStaticParams`.

**Nothing else changed:** `generateMetadata()`, `notFound()`, `generateStaticParams()` bodies, layouts, `middleware.ts`, `app/not-found.tsx`, redirects — all byte-identical. `content/`, `lib/`, `components/`, `scripts/`, `eval/` show **0** diffs.

---

## 3. Tag enumeration verification — PASSED

The gate: does `getAllTagSlugs()` completely enumerate every valid tag represented in content?

**Yes — and it cannot fail to, by construction.** From `lib/tags.ts`:

```ts
export function getAllTagSlugs(): string[] {
  return buildTagIndex().map((e) => e.tag)          // every tag with >= 1 item
}
export function getTagItems(tag: string): ContentMeta[] {
  return buildTagIndex().find((e) => e.tag === tag)?.items ?? []
}
```

`buildTagIndex()` is the **sole source for both** the prerendered set (`generateStaticParams`) and the page's own guard (`if (items.length === 0) notFound()`). The set that gets prerendered and the set that does not 404 are therefore **the same set**.

Independent corpus enumeration over the exact `SECTIONS` list (`docs, systems, labs, case-studies, playbooks, failures, logs` — note: **not** `lessons`):

```
distinct tags with >= 1 content item : 291
tags prerendered but 404-ing         : 0  (impossible by construction)
tags with content but not prerendered: 0  (impossible by construction)
DISCREPANCY                          : NONE
```

Parser completeness was checked: **214** content files use inline `tags: [...]`, **0** use the YAML-list form, so nothing was missed.

**Conclusion: the tags route was safe to include, and was included.**

### One consequence worth stating plainly

Two tags referenced by `entity.depends_on` / `entity.used_by` in `lib/entities.ts` have **no content items**:

```
/tags/github-actions      200, 36,772 B  — renders "Page not found"
/tags/ai-execution-lab    200, 36,778 B  — renders "Page not found"
```

These are rendered as internal links on tag pages (`app/tags/[tag]/page.tsx:280, 296`). **After this fix they return 404 instead of 200.**

This is **not an enumeration discrepancy and not a regression of valid content** — both pages already display "Page not found"; they were broken already, just dishonestly, returning 200. The fix makes them truthful. Correcting the underlying entity references would mean editing `lib/entities.ts`, which is explicitly out of scope here. **Recorded as a known, separate follow-up.**

Controls with real content, for contrast: `/tags/next.js` (106,403 B) and `/tags/vercel` (124,731 B).

---

## 4. Local build result

| Gate | Result |
|---|---|
| `tsc --noEmit` | **exit 0**, no diagnostics |
| scam-intel suite | **30/30 pass**, 0 fail |
| `next build` | **exit 0** — `✓ Compiled successfully in 18.3s` |
| **Page count** | **1033 / 1033** |

**Page count is identical to the 1033 baseline — zero delta, nothing to investigate.** This is the expected result: `dynamicParams` governs the handling of params *outside* `generateStaticParams`; it does not change the generated set.

---

## 5. Manifest result

From `.next/prerender-manifest.json` after the build:

```
--- the 12 fixed routes (expect fallback: false) ---
OK  /failures/[slug]                    fallback=false
OK  /labs/[slug]                        fallback=false
OK  /docs/[slug]                        fallback=false
OK  /case-studies/[slug]                fallback=false
OK  /logs/[slug]                        fallback=false
OK  /playbooks/[slug]                   fallback=false
OK  /systems/[slug]                     fallback=false
OK  /tags/[tag]                         fallback=false
OK  /pathways/[id]                      fallback=false
OK  /scam-intelligence/[slug]           fallback=false
OK  /tracks/[track]                     fallback=false
OK  /tracks/[track]/[module]/[lesson]   fallback=false
=> 12/12 now fallback:false
```

**Before the fix all twelve were `fallback: null`.** The manifest is the authoritative confirmation that the mechanism identified in the discovery audit was the correct one.

**Remaining `fallback: null` routes: 1** — `/trustseal/[locale]/icon.svg`, an icon route, never in scope.

**Deliberate open-set routes:** `/trustseal/[locale]/trust/[domain]` and `/trustseal/[locale]/certificate/[domain]` remain **absent from `dynamicRoutes`** — exactly as before the change. They are server-rendered rather than prerendered, their `dynamicParams = true` exports are untouched, and their source files are not in the diff.

---

## 6. Before / after route behaviour

| | Before (measured in production) | After (expected) |
|---|---|---|
| Nonexistent slug, 12 families | **HTTP 200** | **HTTP 404** |
| robots meta on those | **`index, follow`** | **`noindex`** |
| `<title>` | `AI Execution Lab — A Square Solutions` | `404 — Page Not Found \| AI Execution Lab` |
| `X-Matched-Path` | `/failures/[slug]` (dynamic fallback) | routing-layer rejection |
| `generateMetadata` for unknown param | runs, returns `{}` | never runs |
| Valid URLs | 200 + canonical | unchanged |
| Build page count | 1033 | **1033 — confirmed** |

---

## 7. Production verification

**Status at time of commit: pending deployment.**

Local gates and the manifest are complete and passing; production behaviour cannot change until this commit is deployed. The verification protocol executed immediately after push, for **all 12 families**:

1. one known-valid URL per family → must remain **HTTP 200**
2. one definitely nonexistent slug per family → must return **HTTP 404**
3. nonexistent URL emits **`noindex`**
4. nonexistent URL does **not** emit `index, follow`
5. canonical/metadata behaviour on valid pages intact
6. the two open-set trustseal control routes retain their intended behaviour

Results are reported alongside this commit. **Per the standing instruction, "Ready/Success" is asserted only on confirmed observation — never predicted.**

---

## 8. Regression checks

### Curriculum — W6 Item 1 intact

| Metric | Expected | Observed |
|---|---|---|
| missing principle | 5 | **5** ✅ |
| Practice relationships | 3 | **3** ✅ |
| teachable | 3 | **3** ✅ |
| missing practice | 17 | **17** ✅ |
| units | 20 | **20** ✅ |
| capabilities | 11 | **11** ✅ |
| taught | 9/11 | **9 of 11** ✅ |
| mapped assets | 12 | **12** ✅ |
| unknown refs | 0 | **0** ✅ |
| graph | valid | **valid — acyclic, all references resolve** ✅ |
| `findPractice()` tag refs | 0 | **0 — explicit-only** ✅ |
| `curriculum_version` | 1.0.0 | **1.0.0** ✅ |

The three `reproduces` declarations unchanged: `edge-runtime-deployment-failure`, `gemini-json-parse-failure`, `server-module-client-bundle`.

### Source surfaces

```
content/ 0 diffs · lib/ 0 diffs · components/ 0 diffs · scripts/ 0 diffs · eval/ 0 diffs
middleware.ts 0 · app/not-found.tsx 0
```

---

## 9. Integrity

```
files modified : 13 = the 12 intended routes + app/api/scam-intel/quick-check/route.ts
                 (route.ts is the PRE-EXISTING modification; not edited, not staged, not committed)
staged before commit : the 12 route files + this report ONLY
worktrees : 1     state/ : absent     governance.json : untouched
W6 audit reports (NEXT_ACTION, PROOF_UNIT, SOFT_404_INTEGRITY) : untracked, unmodified, unstaged
```

---

## 10. Remaining limitations

1. **Two contentless entity tag links** (`github-actions`, `ai-execution-lab`) move from a dishonest 200 to a truthful 404. Fixing the references means editing `lib/entities.ts` — out of scope, recorded as a follow-up.
2. **`/trustseal/[locale]/icon.svg`** remains `fallback: null`. An icon route, not a content page; never in scope.
3. **No automated test guards this.** Nothing under `eval/` references `dynamicParams`. A regression would only be caught by re-running the manual probe matrix. Adding a test is a separate decision.
4. **`generateMetadata`'s `if (!item) return {}` pattern remains** in all 12 routes. It is now unreachable for unknown params, so it is harmless — but it is still the latent second cause, and would resurface if `dynamicParams` were ever removed. Changing it would be unrelated cleanup and was deliberately not done.
5. **Deep-linked fake URLs already crawled** (if any) will now return 404. That is the intended outcome; whether any were indexed is unknown and requires Search Console data this audit did not have.
6. **Page count parity (1033) was verified locally**, not on Vercel's build. A production build difference would show up in the deployment log.
