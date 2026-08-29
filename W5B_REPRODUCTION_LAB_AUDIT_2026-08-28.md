# W5b — Reproduction Lab Audit

**Date:** 2026-08-28 · **HEAD:** `52f27702ee4b0fa8da08207dd07f5854f2e2aaea`
**Preceding:** W5a replaced tag-overlap inference with explicit lab `reproduces` declarations. `teachable` 5 → 1, `missing practice` 15 → 19.
**Mode:** discovery only. Nothing implemented. Read-only commands; `governance`, `student`, `prove`, `assess` **not run** (governance computed via the pure `classifyChange()` function). No destructive reproduction was performed.

---

## 1. Executive conclusion

**Three incidents — and only three — can be faithfully reproduced from this repository with no external service, no credentials, and no production risk. All three have live anchors in this codebase, and each already carries a preventive comment that a student would be deliberately violating.**

| Incident | Reproduction | External deps | Failure surface |
|---|---|---|---|
| `edge-runtime-deployment-failure` | add one export to `app/opengraph-image.tsx` | **none** | `next build` fails loudly |
| `server-module-client-bundle` | add a Node import to `lib/tracks.ts` | **none** | `next build` fails loudly |
| `next-mdx-remote-v6-blockjs` | flip `blockJS: false` in `components/content-renderer.tsx` | **none** | **build succeeds, output is empty** |

The remaining **16 incidents all require something the student does not have**: a Firebase project, payment-provider keys, a WordPress host, a GA4 property, Search Console plus a crawl wait, DNS control plus hours of propagation, a Gemini API key, or a Claude Code subscription. Not one of them can be reproduced locally.

**This corrects one of W5's three suggestions.** W5 proposed `environment-variable-missing-production`; on reading the source it needs **a WordPress host and a Gemini API key** to observe the failure, so it is rejected here and replaced by `next-mdx-remote-v6-blockjs` — which is local, deterministic, and teaches a *silent* failure the other two do not.

**Recommended W5b: three labs.** Not because three is a target, but because exactly three qualify and each teaches a distinct mechanism: runtime API-surface incompatibility · transitive client/server boundary · a dependency default change that fails silently.

---

## 2. Current Practice architecture after W5a

Verified in code at `lib/university/engine/curriculum.mjs`:

```js
function findPractice(incident, labs) {
  const hit = labs.find(l => (l.fm.reproduces ?? []).includes(incident.slug))
  return hit ? { doc: hit, via: 'reproduces' } : null
}
```

**Tag references inside `findPractice`: 0.** Confirmed by grep.

The doc comment states the contract: *"Nothing is inferred: same vendor, same platform, same tags or same subsystem do not make a lab a reproduction of an incident."*

**Consequences binding this audit:**

- **Tag overlap is not evidence of reproduction.** Shared tags, vendor, platform, title similarity or subsystem may be *discovery clues* only. Nothing in the design below depends on them.
- A lab creates Practice **only** by naming an incident slug in `reproduces:`.
- Absent an explicit declaration, Practice is absent and reported as absent.
- The identifier is the **incident slug** — the failure filename without `.mdx`.

**Do not reintroduce inference in any form.**

---

## 3. The 19 Practice gaps

Structured fields read from frontmatter. `gemini-json-parse-failure` is excluded — it is the one unit with Practice.

| Incident | Sev | Type | Resolution | Repeat | Words / §§ |
|---|---|---|---|---|---|
| `server-module-client-bundle` | **high** | build | 18 min | medium | 1,022 / 5 |
| `edge-runtime-deployment-failure` | **high** | deployment | 23 min | low | 844 / 4 |
| `next-mdx-remote-v6-blockjs` | medium | dependency | 41 min | medium | 2,487 / 8 |
| `vite-github-pages-spa-routing` | **high** | deployment | 47 min | high | 1,245 / 5 |
| `environment-variable-missing-production` | **high** | configuration | 52 min | high | 1,280 / 6 |
| `razorpay-test-live-key-mismatch` | **high** | configuration | 10 min | — | 925 / 6 |
| `firebase-functions-node-version-stability` | **high** | configuration | 20 min | — | 947 / 7 |
| `wordpress-sitemap-404` | **high** | configuration | 5 min | — | 907 / 6 |
| `claude-code-context-exhaustion` | medium | configuration | 45 min | high | 2,336 / 7 |
| `dns-subdomain-propagation-delay` | medium | deployment | 4 h (propagation) | high | 1,314 / 5 |
| `firebase-auth-domain-not-authorized` | medium | configuration | 2 min | — | 803 / 5 |
| `firebase-deploy-sequence-auth-failure` | medium | — | — | — | 1,340 / 10 |
| `gemini-rate-limit-429-no-ux` | medium | configuration | 2 h | — | 1,492 / 7 |
| `litespeed-client-cache-bypass-ignored` | medium | configuration | 15 min | — | 1,314 / 7 |
| `wordpress-hfe-wpautop-injection` | medium | configuration | 45 min | — | 1,317 / 7 |
| `wordpress-rest-api-auth-failure` | medium | authentication | 35 min | high | 1,141 / 5 |
| `ga4-cross-domain-tracking-gap` | low | configuration | 2 h | medium | 1,288 / 6 |
| `ga4-preview-environment-contamination` | low | configuration | 30 min | — | 1,315 / 6 |
| `gsc-index-coverage-drop` | low | configuration | 25 min | medium | 2,283 / 7 |

**Every one is documented well enough to read. Only three are reproducible without external access** — §6.

---

## 4. The five existing labs

| Lab | `result` | Reproduces a documented incident? | Disposition |
|---|---|---|---|
| `gemini-structured-output-reliability` | confirmed | **Yes — `gemini-json-parse-failure`** | ✅ already declared (W5a) |
| `litespeed-ucss-scoped-css-stripping` | confirmed | **No** — it reproduces *UCSS stripping `.postid-XXXX` scoped CSS*, a phenomenon with **no failure document**. The matched incident was *LiteSpeed ignoring client `no-cache` headers* — different subsystem. | Ordinary Lab content. **No `reproduces`.** |
| `wordpress-ecosystem-rollout-evidence` | confirmed | **No** — 4,164 words of production screenshots; hypothesis is about *documentation durability*. A build record, not a reproduction. | Ordinary Lab content. **Never** `reproduces`. |
| `quickfix-semantic-html-ai-extraction` | **ongoing** | No — tests whether semantic HTML improves AI fact extraction | Ordinary Lab content |
| `2026-05-18-geo-entity-density-experiment` | **ongoing** | No — tests whether entity density raises citation frequency | Ordinary Lab content |

**W5a's conclusion holds unchanged: one verified reproduction in the corpus.** No new source evidence contradicts it.

Worth recording: the litespeed lab is a **genuine reproduction experiment whose phenomenon has no incident record**. It is the mirror image of the gap — a lab without an incident, alongside 19 incidents without a lab.

---

## 5. Candidate analysis — the three that qualify

### ① `edge-runtime-deployment-failure` — **strongest**

- **Mechanism** (from `IncidentReport rootCause`): `app/opengraph-image.tsx` gained `export const runtime = 'edge'` during a refactor. The Edge Runtime does not support the Node.js `crypto` module, which `next/og` uses internally. *"Vercel's build succeeded locally (Node.js runtime) but failed on the edge worker."*
- **Symptom:** full deployment blocked; every push failed during build. `time_to_detect`: *"2 minutes — next push after the change."*
- **Resolution:** remove the runtime export. Next.js defaults OG routes to Node.js.
- **Live anchor:** `app/opengraph-image.tsx` **exists** and carries a preventive comment written after this incident — *"// No edge runtime — Node.js serverless is stable on Vercel and ImageResponse works identically. Edge runtime on metadata image files can cause deployment [failures]"*. **The student deliberately violates a comment the codebase already wrote to stop them.**
- **Reproduction is one line.** The doc's own prevention pattern #3 says: *"Run `next build` locally after adding any runtime export — the error surfaces during static page generation."* The incident is therefore reproducible **without deploying**.
- **Deterministic:** yes. **Externals:** none. **Production risk:** none.

### ② `server-module-client-bundle` — **strong**

- **Mechanism:** `lib/tracks.ts` imported `fs` and `path` at top level; `components/tracks/track-roadmap.tsx` is `'use client'` and imports from `lib/tracks.ts`. Next.js bundles the entire import tree of a client component for the browser, which has no Node built-ins.
- **Symptom:** `Module not found: Can't resolve 'fs'` with an import trace. `time_to_detect`: *"Immediate — next build fails."*
- **Resolution:** move `getLessonContent()` to a server-only file.
- **Live anchor:** the fix is still in place — `lib/lesson-content.ts` **exists**, and three `'use client'` components still import `@/lib/tracks` (`lesson-nav.tsx`, `lesson-sidebar.tsx`, `track-card.tsx`). **The exact import chain that caused the failure is live in this repository.**
- **Reproduction:** add `import fs from 'fs'` to `lib/tracks.ts`, run `next build`.
- **Deterministic:** yes. **Externals:** none. **Production risk:** none.
- **Pedagogical bonus:** this is the incident that *created* `lib/lesson-content.ts`, the file that serves every lesson route the student is reading.

### ③ `next-mdx-remote-v6-blockjs` — **strong, and the only silent one**

- **Mechanism:** upgrading to next-mdx-remote v6 silently stripped all array and object literal props from JSX components in MDX. `StepList`, `Checklist` and `LessonObjectives` rendered empty.
- **Symptom — the important part:** `time_to_detect` is *"Manual visual inspection post-deploy — **build succeeded**."* No error. No warning. The document has a section titled **"Why Silent Failures Are Worse."**
- **Live anchor:** `components/content-renderer.tsx:112` carries the comment *"next-mdx-remote v6 defaults blockJS:true which strips JS expressions"* and line 116 sets **`blockJS: false`**. **next-mdx-remote 6.0.0 is installed.**
- **Reproduction: flip `blockJS: false` → `true` and rebuild.** No dependency change, **no `npm install`** — which matters, because `ComSpec=C:\ffmpeg` breaks `npm run` in this environment. Any candidate requiring a version change would be blocked; this one is not.
- **Observable:** the student's own `<LessonObjectives>` renders empty while the build reports success.
- **Deterministic:** yes. **Externals:** none. **Production risk:** none.

---

## 6. Safety / isolation analysis

Scanned every non-candidate incident for the access it requires:

| Incident | Requires |
|---|---|
| `claude-code-context-exhaustion` | Claude Code subscription |
| `dns-subdomain-propagation-delay` | DNS control + **hours** of propagation + GitHub Pages deploy |
| `environment-variable-missing-production` | **WordPress host + Gemini API key** |
| `firebase-auth-domain-not-authorized` | Firebase project + payment keys + DNS + gh-pages |
| `firebase-deploy-sequence-auth-failure` | Firebase project + payment keys + DNS + gh-pages |
| `firebase-functions-node-version-stability` | Firebase project + payment keys + Gemini key |
| `ga4-cross-domain-tracking-gap` | WordPress host + GA4 property |
| `ga4-preview-environment-contamination` | GA4 property |
| `gemini-rate-limit-429-no-ux` | Firebase project + Gemini API key |
| `gsc-index-coverage-drop` | WordPress host + Search Console + **crawl wait** |
| `litespeed-client-cache-bypass-ignored` | WordPress host with LiteSpeed |
| `razorpay-test-live-key-mismatch` | Firebase project + **payment-provider keys** |
| `vite-github-pages-spa-routing` | DNS + GitHub Pages deploy |
| `wordpress-hfe-wpautop-injection` | WordPress host |
| `wordpress-rest-api-auth-failure` | WordPress host + Claude Code |
| `wordpress-sitemap-404` | WordPress host + Search Console + DNS |

**16 of 16 need external access. The three candidates need none.**

For the three candidates, every safety condition is satisfied: reproducible **locally**, in the student's **own disposable project**, without touching production, without sending email, without customer data, and without destroying infrastructure. Each is a **one-line change reverted by `git checkout`**.

**`razorpay-test-live-key-mismatch` is explicitly excluded on safety grounds** as well as access: it involves live-vs-test payment keys, and no lab should invite a student near that boundary.

---

## 7. Ranked candidates

| Rank | Incident | Sev | Determ. | Evidence | Isolation | Observable | Effort | Distinct mechanism |
|---|---|---|---|---|---|---|---|---|
| **1** | `edge-runtime-deployment-failure` | high | ✅ | 844w + QuickFix + prevention patterns | ✅ local | loud build failure | **1 line** | runtime API-surface incompatibility |
| **2** | `server-module-client-bundle` | high | ✅ | 1,022w + import trace + before/after fix | ✅ local | loud build failure + trace | **1 line** | transitive client/server boundary |
| **3** | `next-mdx-remote-v6-blockjs` | medium | ✅ | 2,487w, 8 §§, "Why Silent Failures Are Worse" | ✅ local | **silent** — empty render, green build | **1 line** | dependency default change |

Ranked on evidence and reproducibility, not severity. #3 ranks third on severity but is arguably the most valuable pedagogically, because it is the only one where **the gate passes and the product is broken** — the exact case W4b's detection lesson calls the green-build blind spot.

---

## 8. Rejected candidates

- **`environment-variable-missing-production`** — *proposed by W5, rejected here.* Needs a WordPress host and a Gemini key to observe. A student cannot see the failure without both.
- **`vite-github-pages-spa-routing`** — needs a real gh-pages deploy and DNS; the failure only appears on direct URL visit to a deployed SPA.
- **`razorpay-test-live-key-mismatch`** — payment keys; unsafe by category.
- **All Firebase incidents** (4) — project, credentials, and in two cases payment keys.
- **All WordPress incidents** (5) — a host with specific plugins (LiteSpeed, HFE, Rank Math).
- **Both GA4 incidents** — a GA4 property, and contamination needs two environments.
- **`gsc-index-coverage-drop`** — Search Console plus a crawl cycle measured in days.
- **`dns-subdomain-propagation-delay`** — the failure *is* a multi-hour wait.
- **`claude-code-context-exhaustion`** — needs a Claude Code subscription; and the "failure" is the tool behaving as designed at its limit.
- **`firebase-deploy-sequence-auth-failure`** — additionally, its frontmatter has no `severity`, `failure_type` or `resolution_time`.

**None of these should receive a lab now.** Several could become labs later if the Lab ever publishes a disposable sandbox project — that is a separate, larger question.

---

## 9. Minimal implementation proposal

Three labs in `content/labs/`, each declaring exactly one `reproduces`.

### Lab A — `reproduce-edge-runtime-build-failure.mdx`
- **Reproduces:** `edge-runtime-deployment-failure`
- **Setup:** any Next.js app with an `app/opengraph-image.tsx` using `next/og`
- **Student action:** add `export const runtime = 'edge'` to that file
- **Observable failure:** `next build` fails during static page generation; `next/og` needs Node `crypto`
- **Recovery direction:** remove the export; Node.js is the correct default
- **Proof artefact:** the build error output plus the one-line diff
- **Sources:** `content/failures/edge-runtime-deployment-failure.mdx`; `app/opengraph-image.tsx` (preventive comment)

### Lab B — `reproduce-client-bundle-boundary.mdx`
- **Reproduces:** `server-module-client-bundle`
- **Setup:** a Next.js app with a `'use client'` component importing a shared `lib/` module
- **Student action:** add `import fs from 'fs'` to the shared module
- **Observable failure:** `Module not found: Can't resolve 'fs'` **with the import trace naming the client component**
- **Recovery direction:** split the Node-dependent function into a server-only file
- **Proof artefact:** the import trace plus the split diff
- **Sources:** `content/failures/server-module-client-bundle.mdx`; `lib/lesson-content.ts`; the three `'use client'` components importing `@/lib/tracks`

### Lab C — `reproduce-silent-mdx-prop-stripping.mdx`
- **Reproduces:** `next-mdx-remote-v6-blockjs`
- **Setup:** next-mdx-remote v6 rendering an MDX component that takes an array prop
- **Student action:** set `blockJS: true` (or remove the explicit `blockJS: false`)
- **Observable failure:** **build succeeds**; the component renders empty
- **Recovery direction:** set `blockJS: false` explicitly and know why
- **Proof artefact:** before/after rendered output plus the config diff — the student must show the build *passing* in both
- **Sources:** `content/failures/next-mdx-remote-v6-blockjs.mdx`; `components/content-renderer.tsx:111-117`

**Why these are labs and not explanatory content:** each names a specific edit the student makes to their own project, a failure they observe themselves, and an artefact they produce. None restates the fix as prose — the incident documents already do that, and the lab must send the student to the incident *before* the fix, per `reproductionTask()`'s step 1: *"read the incident, not the fix."*

**Scope discipline:** three labs, three `reproduces` keys, one line each. **No lesson, no `proves`, no `lib/tracks.ts` change, no engine change, no new failure document.**

---

## 10. Governance

Computed via `classifyChange()`:

| Action | Class |
|---|---|
| Author new lab files in `content/labs/` | **none** |
| Add `reproduces:` to those new labs | **none** |
| *(A new failure document would be)* | *minor — `unitAdded`* |

**W5b as proposed is governance class `none`.** No unit is added — the 20 incidents already exist; a lab attaches to one, it does not create one. No capability, graph, rubric or graduation change. **Do not modify `governance.json` or `curriculum_version`.**

Note: reducing `missing practice` does **not** change the governance class. The metric is derived output, not governed structure.

---

## 11. Expected metric effect

Only if each lab genuinely qualifies:

| After | teachable | missing practice | Units at 3/4 |
|---|---|---|---|
| Now | 1 | 19 | 1 |
| + Lab A | 2 | 18 | 2 |
| + Lab B | 3 | 17 | 3 |
| + Lab C | 4 | 16 | **2** ⚠ |

⚠ `next-mdx-remote-v6-blockjs` is currently **2/4** (incident + principle). Adding Practice takes it to **3/4**. `edge-runtime-deployment-failure` and `server-module-client-bundle` are both 2/4 and go to 3/4 as well. Corrected: all three reach **3/4**, so units at 3/4 would be **1 → 4**.

**Ceiling remains 3/4** — Proof is hardcoded absent for all 20 units.

**Unchanged:** competencies 6 · capabilities 11 · units 20 · missing principle 7 · instructional coverage 9/11 · mapped assets 12 · unknown 0 · students 0.

---

## 12. Explicit non-goals

1. **Do not reintroduce tag inference** in any form.
2. **Do not add `reproduces` to any existing lab.** Only the three new labs, and only to their one incident each.
3. **Do not add `reproduces: []`** to labs that reproduce nothing.
4. **Do not write a lesson.** W5b is Practice, not teaching.
5. **Do not create a failure document** — that is `minor` and changes the unit count.
6. **Do not touch** `lib/tracks.ts`, `proves`, capabilities, competencies, units, rubric, certification, graduation, graph, Proof, or student state.
7. **Do not attempt the 16 externally-dependent incidents.**
8. **Do not perform the reproductions against production** — the labs instruct, they do not execute.
9. **Do not fix** the soft-404, eval C: paths, ComSpec, `related_docs`, or ROS.
10. **Do not chase `missing practice` downward.** Three labs because three qualify.

---

## 13. Verification baseline

```
HEAD              : 52f27702ee4b0fa8da08207dd07f5854f2e2aaea   sync 0/0   staged 0
tracked mods      : app/api/scam-intel/quick-check/route.ts (pre-existing)
untracked         : 126 files (incl. prior audit reports — not W5b work)
lib/university    : 15 files   lib/university/data : 6 files
content/failures  : 20 files   content/labs : 5 files   content/lessons : 57 files
state/            : absent
metrics           : competencies 6 · capabilities 11 · units 20 · teachable 1
                    missing principle 7 · missing practice 19 · taught 9/11 · students 0
```

---

## 14. Recommended next action

**Approve W5b Phase 2 as three labs**, implemented in rank order — A (`edge-runtime`), B (`client-bundle`), C (`silent MDX stripping`) — each declaring one `reproduces`, each grounded in an incident document plus a live in-repo anchor.

If you prefer a smaller first step, **Lab A alone** is the cleanest possible proof of the format: one line, one build, one loud failure, and a preventive comment in the codebase that the student is knowingly overriding.

The honest framing either way: **this repository can currently support three genuine reproductions out of twenty incidents.** The other seventeen need infrastructure a student does not have, and saying so is more useful than pretending otherwise.
