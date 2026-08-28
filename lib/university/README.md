# AI Lab University Engine

```
node lib/university/university.mjs status
```

The institutional engine for AI_LAB_UNIVERSITY.md v1.0. It encodes the approved
architecture — it does not redesign it, and it **creates no lessons, no content and no
videos**. It maps the corpus that already exists and reports what is missing.

## What it does not own

| Already exists | Owner | Engine behaviour |
|---|---|---|
| 20 production failures, 5 labs, 53 lessons, 15 logs | `content/` | reads frontmatter |
| Track, module and lesson ids | `lib/tracks.ts` | parses as a second metadata source |
| Lesson completion | `lib/progress.ts` | **never duplicated** — see below |
| Studies, claims, limitations | `STUDY_MANIFEST.json` | reads |
| Study lifecycle, corrections | Research OS | reads `build/ros/status.json` |
| Research rules | `RESEARCH_STANDARD.md` | defers to |

Research and the ROS are frozen. This engine **only reads** them and writes nothing back.

## Progress: exposure is not attainment

`lib/progress.ts` owns lesson completion. This engine does not read localStorage and
does not duplicate it, because the architecture refuses completion percentages and
streaks. Completing a lesson is **exposure**. Only a proven capability or a certified
portfolio changes standing. The two are deliberately separate systems.

## Commands

`status` · `graph` · `curriculum` · `gaps` · `unit <id>` · `lab <id>` · `research` ·
`contribute <study>` · `student [id]` · `prove <id> <cap> <artifact>` ·
`assess <e> <h> <r>` · `project <competency>` · `governance` · `report`

## Engines

**Competency graph** — 6 competencies, validated acyclic. Foundations → {Building,
Integrating, Operating} → {Evidencing, Distributing}.

**Prerequisite** — capabilities with proof tasks, never completed lessons. A competency
unlocks when its prerequisites are *certified* **or** every capability under them is
*proven*. That bypass is what makes the tree navigable rather than a queue.

**Curriculum** — builds units from `content/failures/`, each with four beats. Where a
beat has no source document the unit is reported incomplete. **Nothing is authored.**

**Assessment** — the post-mortem rubric, three criteria, pass mark 2/3 on every one:
evidence quality, honesty about the unproven, reproducibility of the fix. The same
rubric this company applies to its own research.

**Certification** — portfolio only: deployed artefact, deliberate incident with log,
fix, post-mortem. A localhost URL is rejected as an artefact.

**Governance** — curriculum semver, change classes, and the rule that an issued
certificate keeps the version it was assessed under. Units are retired, never deleted.

## Classification is multi-label — and why

Tags describe **where** a failure happened; a competency describes **what it teaches**.
A single-label classifier assigned `firebase-functions-node-version-stability` to
Integrating on its Firebase tags and left **Operating with zero units** — which would
have made graduation impossible, since Operating is mandatory.

Multi-label fixed it, and it is what the approved architecture already said: *"the same
unit may appear in several tracks."* A structural rule now grants Operating on any
resolved incident carrying a severity, because detection and write-up are what an
incident record *is*, independent of the technology.

Result: Operating 7 primary / 18 teaching — the largest competency, matching the
architecture's independent claim that it is the strongest and least-exploited.

## What the engine reports today

- **20 units, 5 teachable.** 15 lack a reproduction lab; 7 lack a principle document.
- **3 ambiguous** classifications, reported for a human decision rather than guessed.
- **0 Evidencing units teachable.** All three studies are blocked: two carry open
  corrections, one is unpublished. Evidencing cannot be certified today.
- **Governance FAILING** — curriculum v1.0.0 approval is pending, so no certificate may
  be issued. That is the correct starting state, not a defect.

## Deliberately not built

No `types.ts`. Adding a TypeScript file to `lib/` puts it in the Next.js type-check and
build surface, and nothing here is wired into the app. The engine is plain `.mjs` that
no page imports, so it cannot affect a build or a deployment.

No publishing, no deployment, no writes outside `lib/university/state/` and
`build/university/`.
