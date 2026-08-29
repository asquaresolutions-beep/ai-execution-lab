# W5b Lab C — `next-mdx-remote-v6-blockjs` Empirical Reproduction

**Date:** 2026-08-29 · **HEAD:** `8c01c072577e0ef72ee7f977b7f963bae425b982`
**Phase:** 1 — discovery + empirical test only. **No lab was created.** No `reproduces` added, no incident modified, nothing staged, committed, pushed or deployed. The main working tree was never modified.

---

## Verdict, first

## **B — HISTORICAL REPRODUCTION NOT CONFIRMED**

The mutation reproduced the incident's **mechanism** but not its **signature**, and the signature is the entire point of this incident.

| | Incident documents | Observed 2026-08-29 |
|---|---|---|
| Compilation | succeeds | **succeeds** ✅ |
| Props inside components | `undefined` | **`undefined`** ✅ |
| Build outcome | **succeeds — ships** | **FAILS, exit 1** ❌ |
| Broken pages | render **empty**, HTTP 200 | **never rendered at all** ❌ |
| How it was caught | manual visual inspection post-deploy | **the build refused to complete** ❌ |

The incident is filed as a **silent green-build failure**. Today the same flag produces a **loud build-terminating crash**. That is a material divergence, so per the hard-stop condition I stopped, attempted no second mutation, and wrote no lab.

---

## 1. Main-tree snapshot (before)

```
HEAD / origin        : 8c01c072577e0ef72ee7f977b7f963bae425b982  (identical, sync 0/0)
staged               : 0
tracked modifications: app/api/scam-intel/quick-check/route.ts  (pre-existing)
untracked            : 132 (-uall)      content/labs : 7      worktrees : 1
node_modules         : 454 entries      state/ : absent
University           : units 20 · teachable 3 · missing practice 17 · taught 9/11
```

| Anchor | sha256 (first 32) |
|---|---|
| `components/content-renderer.tsx` | `805fc34f06b8fdbdc486e4ff17cde6c5` |
| `lib/tracks.ts` | `e6f51f20585203360d4425eb4e1e0732` |
| `next.config.mjs` | `a14436710b11c86fc57754a0eb5d41a8` |
| `content/failures/next-mdx-remote-v6-blockjs.mdx` | `13f5563a730ae3ed7d5cd9d162f200d3` |

---

## 2. Implementation traced

`components/content-renderer.tsx` renders lesson MDX through `MDXRemote` (the incident's fix snippet shows `compileMDX`; the options block is identical — **cosmetic drift, recorded**):

```tsx
<MDXRemote
  source={source}
  components={allComponents}
  options={{
    parseFrontmatter: true,
    // next-mdx-remote v6 defaults blockJS:true which strips JS expressions
    // (array/object literals in JSX props) via removeJavaScriptExpressions.
    blockJS: false,          // <- line 116, the mutation target
    mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [...] },
  }}
/>
```

- `next-mdx-remote` **6.0.0** installed; `dist/remove-javascript-expressions.js` present.
- **56 lesson files** use array-literal props (`items={[...]}`, `session={[...]}`); **0 labs** do.
- The fix is live and load-bearing.

---

## 3. Disposable worktree

```
path        : D:/ClaudeCode/_w5cC-repro   (outside the repository)
HEAD        : 8c01c072577e0ef72ee7f977b7f963bae425b982   — exact match
clean       : 0 dirty
node_modules: junction -> main tree (reparse point confirmed); main count unchanged
```

All three anchors verified byte-identical to main before any mutation.

---

## 4. Baseline — before mutation

```
✓ Compiled successfully
✓ Generating static pages (1033/1033)
BASELINE_EXIT = 0
```

**Rendered-output baseline** captured from real emitted HTML, not exit status alone:

| Page | Evidence |
|---|---|
| `.../debugging-recovery/post-mortem-process.html` | 128,077 bytes · all **6** `LessonObjectives` items present, **2 occurrences each** (HTML + RSC payload) · **38** `<li>` |
| `.../first-product/mvp-with-claude.html` | objective string present · **29** `<li>` |

---

## 5. The exact mutation

```diff
-          blockJS: false,
+          blockJS: true,
```

`numstat: +1 -1`. One line, one file. Verified at build time: worktree dirty **1**, files changed other than `content-renderer.tsx` **0**, main-tree `content-renderer.tsx` sha still `805fc34f...`.

No install, no version change, no component change, no config change, no network, no deployment.

---

## 6. Mutated build result

```
   ✓ Compiled successfully in 18.5s

Error occurred prerendering page "/tracks/claude-code-operator/wordpress-rest-api/wp-auth-patterns".
TypeError: Cannot read properties of undefined (reading 'map')
Export encountered an error on /tracks/[track]/[module]/[lesson]/page:
  /tracks/claude-code-operator/wordpress-rest-api/wp-auth-patterns, exiting the build.

MUTATED_EXIT = 1
```

**Rendered-output comparison — the decisive check:**

| Artefact | Baseline | Mutated |
|---|---|---|
| `post-mortem-process.html` | 128,077 bytes | **does not exist** |
| its 6 objective strings | 2 occurrences each | **0 — no file** |
| its `<li>` count | 38 | **0 — no file** |
| `mvp-with-claude.html` | present, 29 `<li>` | **does not exist** |

**No HTML was emitted for either control page.** The build aborted during export, so there is no "empty component" to observe — there is no page.

---

## 7. What WAS confirmed: the mechanism

The error text corroborates the incident's central claim directly.

The incident states the stripped prop arrives **`undefined`**, not an empty array. Read-only inspection of the components those pages use:

```
components/mdx/lesson-objectives.tsx:13    {items.map((item, i) => (
components/mdx/step-list.tsx:14            {items.map((item, i) => (
components/mdx/terminal-block.tsx:48       {session.map((line, i) => (
```

All three call `.map()` **with no guard**. `undefined.map` throws exactly `Cannot read properties of undefined (reading 'map')` — the observed error.

The failing page `wp-auth-patterns.mdx` carries three such props:

```
line   5: <LessonObjectives items={[
line  86: <TerminalBlock title="terminal — auth test" session={[
line 182: <Checklist items={[
```

So: **`blockJS: true` does strip array-literal props, and they do arrive `undefined`.** That half of the incident is empirically supported. The fix on line 116 is genuinely load-bearing and must not be removed.

---

## 8. What was NOT confirmed: the silent-failure signature

The incident's distinguishing feature — the reason it was selected as Lab C — is its `time_to_detect`:

> "Manual visual inspection post-deploy — **build succeeded**"

and an entire section titled *Why Silent Failures Are Worse*, which asserts the build passes, TypeScript passes, pages return HTTP 200, Lighthouse passes, and only a human looking at the page catches it.

**None of that happened.** The build did not succeed, no page was served, no HTTP 200 existed to inspect. The failure was loud, immediate, and terminated the pipeline at export.

**Compilation did succeed** (`✓ Compiled successfully in 18.5s`), which is a partial and honest match to "build succeeded" — but the incident plainly means the *whole build*, since it describes inspecting deployed pages afterwards.

### Why the effect differs — stated as candidates, not conclusions

I can report only what I measured. Three explanations are consistent with the evidence and **this experiment does not distinguish between them**:

1. The unguarded `.map()` calls in `lesson-objectives.tsx` / `step-list.tsx` / `terminal-block.tsx` may not have existed, or may have been guarded, at the time of the incident.
2. The affected pages may not have been statically prerendered at build time then; a client-side render of `undefined.map` degrades differently from a Server Component throw during export.
3. The incident's own account of "build succeeded" may have been imprecise.

**I am not asserting any of these, and I did not test them.** Doing so would require a second mutation, which is out of scope and unapproved.

---

## 9. What this does NOT license

- **No correction to the incident.** The divergence is real but its cause is undetermined. Correcting `time_to_detect` on this evidence would substitute a guess for the measurement — the same error the edge-runtime correction was made to avoid, in reverse.
- **No lab.** A Lab C written now would either teach the silent failure (unobserved) or teach a build crash (which duplicates the lesson Labs A and B already deliver: a loud build-time failure).
- **No second mutation.** Per the hard stop: *"If the first approved mutation does NOT reproduce the incident: STOP."*

---

## 10. Recovery

```
git checkout -- components/content-renderer.tsx
worktree dirty : 0     blockJS line 116 : false     sha : 805fc34f06b8fdbdc486e4ff17cde6c5
```

Junction removed **non-recursively** via `[System.IO.Directory]::Delete(path, $false)` after confirming the `Directory, ReparsePoint` attribute — never `Remove-Item -Recurse`.

Worktree removed with `git worktree remove --force`, then `git worktree prune`. Directory gone; `git worktree list` back to **1**.

**One counting note, for the record.** A mid-recovery check read main `node_modules` as **452** and I stopped to investigate before touching anything. It was a counting artefact: plain `ls` hides `.bin` and `.package-lock.json`; `ls -A` and `find` both give **454**. `next` 15.5.18 and `next-mdx-remote` 6.0.0 remain resolvable, `.package-lock.json` intact at 281,194 bytes. **Nothing was lost.**

---

## 11. Main-tree integrity

| Check | Result |
|---|---|
| All 4 anchor hashes | **byte-identical to snapshot** |
| `blockJS` in main tree | **`false`** — mutation absent |
| HEAD / origin | `8c01c07...` / `8c01c07...`, sync 0/0 |
| staged | 0 |
| tracked modifications | `route.ts` only, unchanged |
| untracked (-uall) | 132 -> 133 (this report) |
| `content/labs` | 7 |
| worktrees | **1** |
| `node_modules` | 454 |
| `state/` | absent |
| University | **units 20 · 3 teachable** — unchanged |

**The mutation exists nowhere in the main tree.**

---

## 12. Safety classification

| Requirement | Needed? |
|---|---|
| External services · credentials · deployment · production access | **No** |
| Database writes · payment credentials · network calls · real user data | **No** |
| Destructive operations | **No** — one line, discarded with the worktree |
| Modification outside the disposable worktree | **No** |

**Deterministic:** yes — static prop-stripping at compile time, no timing or environmental component.

---

## 13. Options — each needs approval

1. **Stop Lab C here.** Three of the four ranked W5b candidates are now resolved: two shipped, one empirically shown not to reproduce as documented. Practice stays at 3.
2. **Approve a second experiment** to separate the three candidate explanations in §8 — e.g. observing whether a guarded component renders empty rather than throwing. This would establish whether the silent signature is still reachable. **Explicitly out of scope now.**
3. **Approve an incident-accuracy review** of `next-mdx-remote-v6-blockjs`, on the model of the edge-runtime correction — but only *after* (2), since the current evidence identifies a discrepancy without explaining it.

**Recommendation: (1) or (2), not (3) yet.** Correcting the incident before knowing why the behaviour differs would repeat the failure mode this whole protocol exists to prevent.

---

## 14. What was not done

No lab created. No lab modified. No `reproduces` declaration added. No incident modified. No tag added. No University data or engine change. No `governance.json`, `curriculum_version` or approval entry touched. No commit, no push, no deploy, no preview deployment. No second mutation. No package install.

**This phase produced exactly one file: this report.**
