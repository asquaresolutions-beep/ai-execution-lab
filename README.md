# AI Execution Lab

**A practical AI systems lab by [A Square Solutions](https://asquaresolution.com).**

Real workflows, real systems, real results. Everything here comes from actually building
[asquaresolution.com](https://asquaresolution.com), [TrustSeal](https://trustseal.in),
and [ScamCheck](https://scamcheck.in) — not from hypothetical examples.

---

## What's in here

| Section | What it contains |
|---|---|
| `/docs` | Reference documentation — Claude Code, GEO, LiteSpeed, WordPress APIs |
| `/systems` | Documented production systems with architecture decisions and failure modes |
| `/labs` | Active research and experiments with stated hypotheses and findings |
| `/case-studies` | Real results — what we built, what broke, and what we measured |

## Tech stack

- **Next.js 15** — App Router, React Server Components
- **TypeScript** — strict mode throughout
- **Tailwind CSS** + `@tailwindcss/typography`
- **MDX** via `next-mdx-remote` — file-based, frontmatter-typed
- **Dark-first design** — surface-900 base, brand-orange (#f97316) accent

## Local setup

```bash
# Install dependencies (skip native postinstall scripts — see note below)
npm install --ignore-scripts

# Start dev server
node node_modules/next/dist/bin/next dev
```

> **Note — npm on this machine:** Native npm postinstall scripts are blocked (`C:\ffmpeg` intercept).
> Always use `--ignore-scripts` for `npm install`. Always invoke CLI tools via `node path/to/bin`
> rather than the `.bin` shebang wrappers. Next.js works fully without the native Turbopack binary —
> it falls back to the standard compiler.

Open [http://localhost:3000](http://localhost:3000).

## Content authoring

All content lives in `/content/{section}/slug.mdx`. Each file requires frontmatter:

```yaml
---
title: Your Title
description: One-sentence description for index and metadata.
date: "2026-05-17"
tags: [tag1, tag2]
status: published   # or: draft, archived
---
```

Section-specific optional fields:

```yaml
# Systems
stack: [WordPress, Astra, LiteSpeed]

# Labs
hypothesis: "What you expect to find"
result: confirmed | refuted | inconclusive | ongoing

# Case studies
impact: "Brief outcome summary"

# Docs
difficulty: beginner | intermediate | advanced
section: "Sidebar group name"
```

### Custom MDX components

Available in all MDX files without importing:

```mdx
<Callout type="warn" title="Important">
Content here.
</Callout>

<StatsGrid>
  <Stat value="28px" label="After: H2 size" note="Inline style" />
  <Stat value="90px" label="Before: H2 size" note="Astra global" />
</StatsGrid>
```

Callout types: `info` | `warn` | `danger` | `success` | `lab`

## Project status

**Phase: Local development only.**

Not deployed. No auth. No monetization. Building the foundation correctly before scaling.

## Roadmap (rough)

- [x] Core infrastructure — content system, MDX, routing
- [x] First real content from A Square Solutions work
- [ ] Search across sections
- [ ] Table of contents for long documents
- [ ] Lab tools — interactive components (GEO analyzer, prompt testing)
- [ ] GitHub Actions for type-checking
- [ ] Deployment to Vercel (when ready)

---

*A Square Solutions · [asquaresolution.com](https://asquaresolution.com)*
