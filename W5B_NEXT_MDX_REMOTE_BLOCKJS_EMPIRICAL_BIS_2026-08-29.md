# W5b Lab C — Phase 1BIS: Second-Experiment Feasibility

**Date:** 2026-08-29 · **HEAD:** `8c01c072577e0ef72ee7f977b7f963bae425b982`
**Phase:** 1BIS — read-only diagnosis. **No second experiment was run**, because the diagnosis established there is no legitimate surface on which to run one. No worktree created. No mutation. No lab. No incident change. Nothing staged, committed, pushed or deployed.

---

## Verdict

## **MECHANISM CONFIRMED; HISTORICAL SIGNATURE NOT REPRODUCIBLE IN CURRENT TREE**

Per §2 of the brief: *"If no legitimate second mutation exists, STOP and report that the historical silent signature is no longer reachable in the current repository."* That is the finding.

---

## 1. First experiment — unchanged, restated

| Item | Result |
|---|---|
| Baseline | 1033/1033, exit 0 |
| Mutation | `blockJS: false` → `true` |
| Compilation | **succeeded** (`✓ Compiled successfully in 18.5s`) |
| MDX array-literal props | **became `undefined`** |
| Unguarded `.map()` consumers | **caused prerender failure** |
| Final build | **exit 1** |
| Historical silent signature | **NOT reproduced** |
| Main tree / lab / incident | untouched |

Closed and not revisited.

---

## 2. Read-only diagnosis

### 2.1 The blockJS blast radius is the whole corpus, not just lessons

**This corrects a statement I made mid-session.** `MDXRemote` is instantiated in exactly one place — `components/content-renderer.tsx`. A first pass over `app/` suggested only the lessons route consumed it. That was incomplete: `components/content-page.tsx:7` imports `ContentRenderer` and renders it at line 285, and `ContentPage` backs **eleven** route families:

```
app/case-studies/[slug]  app/docs/[slug]     app/failures/[slug]  app/labs/[slug]
app/logs/[slug]          app/playbooks/[slug] app/systems/[slug]
app/trustseal/[locale]/{about,docs,security,trust-center}
```

plus `app/tracks/[track]/[module]/[lesson]` directly. **There is exactly one renderer and one `blockJS` setting; it is global to all MDX.** No second renderer exists to scope a mutation to.

### 2.2 Were the consumers unguarded at the historical time?

**Undetermined, and not determinable from this tree.** Answering it needs the historical revision of the component files, which is a git-history question, not an experiment. Not in scope; not guessed at.

What *is* measurable is the present state, below.

### 2.3 Are the affected components statically prerendered?

**Yes.** `app/tracks/[track]/[module]/[lesson]/page.tsx:33` and `app/failures/[slug]/page.tsx:13` both export `generateStaticParams`, with no `dynamic`/`revalidate`/`dynamicParams` override. All 1033 pages are prerendered at build time, so a render throw is an **export-time build error**, not a runtime 500. Next terminates the export on the first failing page.

### 2.4 Full expression-prop / consumer map

99 content files carry JSX expression props. Fifteen distinct prop names, classified by how the receiving component handles an `undefined` value:

| Consumer behaviour | Props | Effect when stripped |
|---|---|---|
| **Unguarded `.map()`, no default** | `items` (108) · `events` (24) · `steps` (18) · `preventionPatterns` (12) · `session` (11) · `outcomes` (10) · `stack` (8) · `images` (5) · `entries` (1) | **throws** |
| **Default `= []`** | `ecosystemImpact` (12) · `relatedFailures` (10) · `chapters` (3) · `transcript` (1) · `annotations` (1) | renders empty — *would be silent* |
| **Not declared by the component at all** | `tools` (8) | **no observable change** |

By content set:

```
content/lessons   57 files — items (91), session (11)          -> all unguarded
content/labs       7 files — images, events, stack, outcomes   -> all unguarded
content/failures  20 files — steps, preventionPatterns, items, images, entries (unguarded)
                             + ecosystemImpact, relatedFailures (guarded)
content/docs     116 files — items, images, events, stack, outcomes (unguarded)
                             + chapters, transcript, annotations (guarded)
```

### 2.5 Can any route render stripped MDX without hitting a throwing consumer?

**No. This is the decisive result.**

Three candidate surfaces were examined and all three fail:

**Candidate A — pages using only `= []`-guarded props.** Enumerated every file containing a guarded prop and checked whether it also contains an unguarded one. **All 13 do.** Zero files qualify:

```
docs/media-publishing-workflow.mdx          also: images, items
failures/claude-code-context-exhaustion.mdx also: preventionPatterns, steps
... (11 more, every one carrying steps and/or preventionPatterns)
```

On each of those pages the guarded prop renders empty, but an unguarded prop on the *same page* throws first.

**Candidate B — the 8 files whose only expression prop is `tools={[…]}`** (7 logs + 1 playbook). These carry **no** unguarded prop, so they are the only pages that survive `blockJS: true`. But `tools` is passed to `LessonMeta`, and `components/mdx/lesson-meta.tsx` declares:

```ts
interface LessonMetaProps {
  difficulty?: Difficulty
  implementationTime?: string
  evidence?: string
}
```

**`tools` is not a declared prop and is never read.** Stripping it changes nothing that renders. These pages are byte-identical with `blockJS` true or false — there is no broken output to detect, so they cannot demonstrate the signature.

**Candidate C — the one body-level JS expression in the corpus**, `content/docs/analytics-setup.mdx:91`:

```
{VERCEL_ANALYTICS && <VercelAnalytics />}
```

It sits **inside a fenced code block** (7 fences precede it — odd count). It is documentation text, parsed as a `code` node, never evaluated and never stripped. Not a candidate.

### 2.6 Can the "HTTP 200 + empty output" signature exist without unrelated behaviour changes?

**No.** Producing it would require at least one of:

- adding a default or guard to `LessonObjectives` / `StepList` / `TerminalBlock` — **explicitly forbidden** (§2: no defensive guards, no component rewrites)
- making the affected routes non-prerendered — **forbidden** (no routing or build-config change)
- editing MDX content to remove unguarded props — **forbidden** (no unrelated MDX alteration)
- authoring a new content file that uses only guarded props — that is **manufacturing** the surface, which §Objective rules out: *"Do NOT try to make the current code artificially match the historical result."*

Every available path to the signature requires changing the thing under test.

---

## 3. Second mutation

**None performed.** §2 authorised one experiment *only if* the diagnosis identified a legitimate historical-equivalent surface. It did not. Per §3, no worktree was created and no baseline was run, because there was no experiment to baseline.

---

## 4. Result classification — the two kept separate

| | Status | Evidence |
|---|---|---|
| **A. Historical mechanism** | **REPRODUCED** | Experiment 1: `blockJS: true` strips array-literal props; they arrive `undefined`; `TypeError: Cannot read properties of undefined (reading 'map')` is precisely what an unguarded `.map()` on a stripped prop produces |
| **B. Historical failure signature** | **NOT REPRODUCIBLE** | 91 of 99 expression-carrying files hit a throwing consumer; the remaining 8 pass a prop the component does not read; 0 files degrade visibly-but-silently |

The mechanism half stands on measurement. The signature half cannot be produced in this tree by any permitted mutation.

---

## 5. Is the historical silent failure still reachable?

**No — not in the current repository, under the stated constraints.**

The reason is structural, and worth stating precisely: the incident's fix (`blockJS: false`) has been in place long enough that **the corpus grew a dense population of unguarded `.map()` consumers behind it**. `items` alone appears 108 times. Removing the fix today no longer produces quiet degradation; it produces an immediate export crash on the first of ~91 files.

The failure has, in effect, **changed class** — from silent to loud — not because the stripping behaviour changed, but because what sits downstream of it did.

---

## 6. Does the incident need correction?

**Evidence recorded; no correction made; separate approval required.**

The discrepancy is real and narrow:

- `time_to_detect: "Manual visual inspection post-deploy — build succeeded"`
- the section *Why Silent Failures Are Worse* (build passes, TypeScript passes, HTTP 200s, Lighthouse passes)

Neither holds in the current tree. But **that does not establish either claim was wrong when written** — §2.2 shows the historical guard state is undetermined, and the class change in §5 is a fully sufficient explanation that leaves the original account intact.

The honest framing, if a correction is ever approved, is a **dated addendum** ("as of 2026-08-29 this reproduces as a build failure, not a silent one, because …"), not an edit to the historical record. **I did not write one.**

One factual correction I do owe on my own first report: I recorded the stripping plugin as `dist/remove-javascript-expressions.js`. The actual path is **`dist/plugins/remove-javascript-expressions.js`**. The file exists; the path I gave was wrong.

---

## 7. Should Lab C be authored?

**No.**

Per §8 of the brief: *"Do NOT create a reproduction lab whose exercise promises a green build followed by broken output if current code cannot produce that."* Current code cannot produce it.

A lab written on the confirmed mechanism alone would teach *"remove `blockJS: false` and the build crashes"* — which is a loud build-time failure, the same shape Labs A and B already teach. It would add a third instance of a lesson the curriculum has twice, while the one genuinely distinct thing about this incident — the silent signature — would be unreproducible by the student following it.

**Practice stays at 3.**

---

## 8. Integrity

Entire phase was read-only. Nothing was created but this report.

| Check | Result |
|---|---|
| HEAD / origin | `8c01c07…` / `8c01c07…`, sync 0/0 |
| staged | 0 |
| tracked modifications | `route.ts` only (pre-existing) |
| untracked (-uall) | 133 → 134 (this report) |
| worktrees | **1** — none created |
| `state/` | absent |
| `node_modules` (-A) | 454 |
| `content/labs` | 7 |
| `blockJS` in main tree | **`false`** |
| `components/content-renderer.tsx` | `805fc34f06b8fdbdc486e4ff17cde6c5` |
| `lib/tracks.ts` | `e6f51f20585203360d4425eb4e1e0732` |
| `next.config.mjs` | `a14436710b11c86fc57754a0eb5d41a8` |
| `content/failures/next-mdx-remote-v6-blockjs.mdx` | `13f5563a730ae3ed7d5cd9d162f200d3` |

All four anchors byte-identical to the snapshot taken at the start of this phase.

---

## 9. Recommended next action

**Close Lab C.** The W5b candidate set is now fully resolved:

| Candidate | Outcome |
|---|---|
| `edge-runtime-deployment-failure` | Lab A shipped (`763f558`) |
| `server-module-client-bundle` | Lab B shipped (`8c01c07`) |
| `structured-output-contract` | not an incident — blocked |
| `next-mdx-remote-v6-blockjs` | **mechanism confirmed, signature unreachable — no lab** |

Two follow-ups exist, each needing its own approval and neither started:

1. **A dated addendum** to the blockJS incident recording the class change (§6).
2. **A guard-coverage observation** — `items`, `session`, `steps` and `preventionPatterns` are consumed unguarded across 91 files. That is a live fragility independent of this incident, and it is a finding, not a work item; I am not proposing to act on it.

---

## 10. What was not done

No second experiment. No worktree. No mutation of any kind. No guards added, no component rewritten, no error handling changed, no routing changed, no build config changed, no dependency downgraded, no MDX altered. No lab created or modified. No `reproduces` added. No incident modified. No first-experiment result altered. No commit, push, deploy or preview.

**This phase produced exactly one file: this report.**
