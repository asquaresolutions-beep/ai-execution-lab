# W5b Lab C — `structured-output-contract`: Target Verification

**Date:** 2026-08-29 · **HEAD:** `8c01c072577e0ef72ee7f977b7f963bae425b982`
**Mode:** discovery. **No worktree created, no baseline run, no mutation attempted, no lab written.** Nothing staged, committed, pushed or deployed.

---

## Verdict

## **C — BLOCKED**

Not by infrastructure, credentials, or safety. **Blocked because the target does not exist as an incident, and the incident behind it is already fully covered.**

No experiment was run, because there was nothing valid to run it against. Building a worktree and mutating a codebase to reproduce a non-existent incident would have manufactured evidence rather than gathered it.

---

## 1. Snapshot

```
HEAD / origin        : 8c01c072577e0ef72ee7f977b7f963bae425b982  (identical, sync 0/0)
staged               : 0
tracked modifications: app/api/scam-intel/quick-check/route.ts  (pre-existing)
untracked            : 131 files (audit reports + carried-forward work)
content/labs         : 7 files      worktrees : 1      state/ : absent
build page count     : 1033 (last build)
University           : units 20 · teachable 3 · missing practice 17 · taught 9/11
Practice relationships (3):
  edge-runtime-deployment-failure  <- edge-runtime-deployment-reproduction.mdx
  gemini-json-parse-failure        <- gemini-structured-output-reliability.mdx
  server-module-client-bundle      <- server-module-client-bundle-reproduction.mdx
```

Main tree clean apart from the two known carried-forward categories.

---

## 2. Finding 1 — the named incident does not exist

```
content/failures/structured-output-contract.mdx : DOES NOT EXIST
```

All 20 failure slugs in the corpus were enumerated. `structured-output-contract` is not among them:

```
claude-code-context-exhaustion            firebase-functions-node-version-stability   next-mdx-remote-v6-blockjs
dns-subdomain-propagation-delay           ga4-cross-domain-tracking-gap               razorpay-test-live-key-mismatch
edge-runtime-deployment-failure           ga4-preview-environment-contamination       server-module-client-bundle
environment-variable-missing-production    gemini-json-parse-failure                   vite-github-pages-spa-routing
firebase-auth-domain-not-authorized       gemini-rate-limit-429-no-ux                 wordpress-hfe-wpautop-injection
firebase-deploy-sequence-auth-failure     gsc-index-coverage-drop                     wordpress-rest-api-auth-failure
                                          litespeed-client-cache-bypass-ignored       wordpress-sitemap-404
```

**`structured-output-contract` is a capability, not an incident:**

```json
{
  "id": "structured-output-contract",
  "competency": "integrating",
  "statement": "You can make a language model return output your parser accepts, and prove the failure rate fell.",
  "proof_task": "Show a before/after parse-failure rate with the prompt change that caused it.",
  "proof_artifact": "measurement + prompt diff",
  "derived_from_incident": "gemini-json-parse-failure"
}
```

Capabilities live in `lib/university/data/capabilities.json` and are proven by student artefacts. Incidents live in `content/failures/` and are the Incident beat of a unit. **A lab reproduces an incident; it cannot reproduce a capability.**

---

## 3. Finding 2 — the underlying incident already has Practice

The capability's own `derived_from_incident` is `gemini-json-parse-failure`. Its current state:

```
gemini-json-parse-failure
  beats            : 3/4          ← the ceiling (proof is hardcoded absent for all 20 units)
  practice present : true   via reproduces
  practice source  : content/labs/gemini-structured-output-reliability.mdx
  teachable        : true
```

That relationship was declared in **W5a** and is one of the three live Practice relationships. It is the **strongest** in the corpus — the lab is a four-iteration measured experiment matching the incident's exact failure mode.

**There is no Practice gap here to close.** A Lab C targeting this incident would either duplicate an existing relationship or require a second lab claiming the same incident, which the resolver would then have to arbitrate — a problem the W5b Phase 1 audit explicitly flagged as needing a deterministic tie-break that does not yet exist.

---

## 4. Finding 3 — the capability is already taught

```
capability structured-output-contract
  taught          : true
  teaching assets : ["output-contract-measurement"]
```

That lesson shipped in **W4c** (`1ccbbf1`) at `/tracks/claude-code-operator/model-integration/output-contract-measurement`. It teaches the four-iteration measurement and states the source's limitations.

**Both halves of this capability are therefore already covered:**

| Layer | Asset | Status |
|---|---|---|
| Teaching | `output-contract-measurement` (lesson) | ✅ live, W4c |
| Practice | `gemini-structured-output-reliability` (lab) → `gemini-json-parse-failure` | ✅ live, W5a |
| Proof | — | hardcoded absent for all 20 units |

---

## 5. What was not done, and why

Sections 3 through 8 of the brief — trace the implementation, create a disposable worktree, run a baseline, find the smallest mutation, recover — were **not executed**.

They presuppose an incident document describing a historical failure with a mutation to re-cause. There is no such document. Proceeding would have meant choosing a plausible-looking mutation against `lib/scam-intel` or a Gemini call path and presenting whatever it produced as "reproducing the incident" — inventing the mutation the brief explicitly prohibits when *"the historical code no longer exists"*. Here it never existed under this name.

**No worktree was created**, so no recovery was required. Worktree count is **1**, unchanged. `node_modules` untouched at 454 entries. No `state/` directory.

---

## 6. Safety assessment

Not reached. A safety gate evaluates a proposed reproduction; there is no valid reproduction to evaluate. Nothing about this outcome was caused by credentials, external services, production access or destructive operations.

---

## 7. Main-tree integrity

```
content/failures/**  content/labs/**  content/lessons/**  lib/university/**
lib/tracks.ts        application source        governance / certification / ROS
                                          — all UNMODIFIED
staged: 0        worktrees: 1        state/: absent
HEAD: 8c01c07…   sync 0/0
```

Working-tree delta: this report only.

---

## 8. Tag / Practice analysis — recorded, not applied

Existing lab tags (7 labs), for reference when a real Lab C target is chosen:

| Lab | Tags |
|---|---|
| `gemini-structured-output-reliability` | gemini · structured-output · firebase-functions · scamcheck · trustseal · experiment · json · prompt-engineering |
| `edge-runtime-deployment-reproduction` | edge-runtime · next.js · vercel · deployment |
| `server-module-client-bundle-reproduction` | next.js · client-bundle · fs · module-boundary |
| `litespeed-ucss-scoped-css-stripping` | LiteSpeed · UCSS · WordPress · CSS · typography |
| `wordpress-ecosystem-rollout-evidence` | wordpress · operational-evidence · schema-org · ecosystem · seo · geo · deployment · litespeed |
| `quickfix-semantic-html-ai-extraction` | geo · ai-search · structured-output · experiment · seo · next.js |
| `2026-05-18-geo-entity-density-experiment` | geo · ai-search · entity-density · answerability · seo · experiment |

**No tag was added.** No `reproduction` tag exists anywhere (verified: 0 content files; `/tags/reproduction` is a soft-404 shell, not a route). No `reproduces` declaration was created.

---

## 9. Recommended next step

**The real remaining candidate is `next-mdx-remote-v6-blockjs`.**

It was ranked **third** in the W5b Phase 1 audit alongside the two now built, and it is the only one of that trio still unbuilt:

| Original candidate | Status |
|---|---|
| `edge-runtime-deployment-failure` | ✅ Lab A shipped (`763f558`) |
| `server-module-client-bundle` | ✅ Lab B shipped (`8c01c07`) |
| **`next-mdx-remote-v6-blockjs`** | **no lab yet** |

Why it is the right next target, from the Phase 1 evidence:

- **Locally reproducible with no external dependency.** `components/content-renderer.tsx:112` carries the comment *"next-mdx-remote v6 defaults blockJS:true which strips JS expressions"* and line 116 sets `blockJS: false`. **v6.0.0 is installed.** The mutation is flipping that flag — **no `npm install` needed**, which matters because `ComSpec=C:\ffmpeg` breaks `npm run` in this environment.
- **It is the only silent failure of the three.** Its `time_to_detect` reads *"Manual visual inspection post-deploy — **build succeeded**."* Labs A and B both fail loudly; this one passes the gate and ships broken output. That is a genuinely different lesson.
- 2,487 words across 8 sections, including one titled *Why Silent Failures Are Worse*, and it currently sits at **2/4** with Principle already present — a lab takes it to the 3/4 ceiling.

Seventeen incidents still lack Practice; the other sixteen were assessed in the Phase 1 audit as requiring external services, credentials, payment keys, DNS waits or crawl cycles.

**Recommended:** approve a Phase 1 + empirical verification for `next-mdx-remote-v6-blockjs`, following the same protocol that has now twice changed what got written — it caught two false prevention patterns in the edge-runtime incident, and caught that Lab B's obvious one-line mutation builds green.

---

## 10. Summary answer

**C — blocked.** The named target is a capability, not an incident; no `content/failures/structured-output-contract.mdx` exists; its `derived_from_incident` (`gemini-json-parse-failure`) already holds Practice at 3/4 via a W5a-declared lab; and the capability itself is already taught by the W4c lesson `output-contract-measurement`.

**No hypothesis was turned into a teaching asset.** No lab was created, no `reproduces` added, no incident modified, no mutation run.

Awaiting a decision on `next-mdx-remote-v6-blockjs` as the substitute Lab C target.
