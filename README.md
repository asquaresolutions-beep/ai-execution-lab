# AI Execution Lab

**Operational knowledge base by [A Square Solutions](https://asquaresolution.com)**

Real workflows, real systems, real results — documented while building production AI systems, SEO engineering pipelines, and generative engine optimization strategies across [asquaresolution.com](https://asquaresolution.com), [TrustSeal](https://trustseal.in), and [ScamCheck](https://scamcheck.in).

> This is not a tutorial site. Every document here comes from something we actually built, broke, fixed, or measured.

---

## What this is

A structured knowledge platform for capturing and sharing operational AI knowledge — the kind that exists only in codebases, terminal outputs, and post-mortems. Built for internal use at A Square Solutions, open to the public.

**Five sections:**

| Section | Purpose |
|---|---|
| **Docs** | Reference documentation — Claude Code patterns, REST API guides, LiteSpeed internals |
| **Systems** | Documented production systems with architecture decisions and failure modes |
| **Labs** | Active research — hypotheses, methods, findings, ongoing experiments |
| **Case Studies** | Real results — what we built, what broke, and what we measured |
| **Playbooks** | Step-by-step execution guides for repeatable operations |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org) — App Router, React Server Components |
| Language | TypeScript — strict mode throughout |
| Styling | Tailwind CSS v3 + `@tailwindcss/typography` |
| Content | MDX via `next-mdx-remote` — file-based, frontmatter-typed |
| Search | [Fuse.js](https://fusejs.io) — pure-JS fuzzy search, Cmd+K modal |
| Syntax | `rehype-highlight` — code block syntax highlighting |
| Date | `date-fns` — date formatting |
| Design | Dark-first, `#05080f` base, brand orange `#f97316` accent |

---

## Architecture

```
ai-execution-lab/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout — sidebar + search modal
│   ├── page.tsx                # Dashboard homepage
│   ├── globals.css             # Design tokens, typography, dot-grid texture
│   ├── [section]/              # docs/ labs/ systems/ case-studies/ playbooks/
│   │   ├── page.tsx            # Section listing (SectionIndex)
│   │   └── [slug]/page.tsx     # Content detail (ContentPage)
│   ├── api/search/route.ts     # Search index API endpoint
│   ├── sitemap.ts              # Auto-generated XML sitemap
│   └── robots.ts               # robots.txt
│
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx         # Desktop sidebar (server component)
│   │   ├── sidebar-nav.tsx     # Nav links with active state (client)
│   │   └── top-bar.tsx         # Mobile header + drawer (client)
│   ├── search/
│   │   ├── search-modal.tsx    # Cmd+K search (client, Fuse.js)
│   │   └── search-trigger.tsx  # Search button for sidebar
│   ├── mdx/
│   │   ├── workflow-block.tsx  # WorkflowBlock + WorkflowStep
│   │   ├── prompt-block.tsx    # PromptBlock with copy button
│   │   ├── code-block.tsx      # CodeBlock with filename + copy
│   │   └── step-list.tsx       # StepList + Checklist
│   ├── media/                  # YouTube, Video, BeforeAfter, Gallery
│   ├── content-page.tsx        # Article layout with TOC, prev/next
│   ├── section-index.tsx       # Section listing component
│   ├── content-renderer.tsx    # MDX renderer with all plugins
│   └── mdx-components.tsx      # Component registry (Callout, Stat, etc.)
│
├── content/                    # All MDX content (one file = one article)
│   ├── docs/
│   ├── systems/
│   ├── labs/
│   ├── case-studies/
│   └── playbooks/
│
└── lib/
    ├── content.ts              # Content system (getAllMeta, getItem, etc.)
    ├── search-index.ts         # Search index builder
    ├── toc.ts                  # Heading extractor for TOC
    └── utils.ts                # cn(), formatDate, SECTION_META, ACCENT_CLASSES
```

### Content system

All content lives in `/content/{section}/slug.mdx`. The content system (`lib/content.ts`) reads files at build time via Node.js `fs`, parses frontmatter with `gray-matter`, and computes reading time.

**Frontmatter schema:**
```yaml
---
title: Your Title
description: One-sentence description for index and SEO metadata.
date: "2026-05-17"
tags: [tag1, tag2]
status: published        # draft | published | archived

# Docs-specific
difficulty: intermediate # beginner | intermediate | advanced
section: "Sidebar group name"

# Systems-specific
stack: [WordPress, Astra, LiteSpeed]

# Labs-specific
hypothesis: "What you expect to find"
result: confirmed        # confirmed | refuted | inconclusive | ongoing

# Case studies
impact: "Brief outcome summary"

# Playbooks-specific
goal: "What this playbook achieves"
prerequisites: [Python 3.9+, WordPress 5.6+]
estimated_time: "30-60 min"
---
```

### Custom MDX components

Available in all MDX files without importing:

```mdx
<!-- Callout blocks -->
<Callout type="warn" title="Important">Content here.</Callout>
<!-- types: info | warn | danger | success | lab -->

<!-- Stats display -->
<StatsGrid>
  <Stat value="28px" label="After: H2 size" note="Inline style" />
  <Stat value="90px" label="Before: H2 size" note="Astra global" />
</StatsGrid>

<!-- Workflow visualization -->
<WorkflowBlock title="Operation flow">
  <WorkflowStep n={1} title="Read" desc="GET /posts/{id}?context=edit" />
  <WorkflowStep n={2} title="Apply" desc="POST updated content" />
</WorkflowBlock>

<!-- Prompt block with copy -->
<PromptBlock title="Research prompt" role="user">
You are an expert in generative engine optimization...
</PromptBlock>

<!-- Named code block with copy -->
<CodeBlock filename="patch.py" language="python">
{`import urllib.request`}
</CodeBlock>

<!-- Numbered steps -->
<StepList items={['Step one', 'Step two', 'Step three']} />

<!-- Verification checklist -->
<Checklist items={['Schema intact', 'No bare headings', 'Links working']} />

<!-- Media -->
<YouTube id="dQw4w9WgXcQ" title="Optional title" />
<VideoEmbed src="/videos/demo.mp4" poster="/videos/demo-poster.jpg" />
```

---

## Local Development

> **Note on this machine:** Native npm postinstall scripts are blocked (`C:\ffmpeg` directory intercepts). Always use `--ignore-scripts` and invoke CLI tools via `node path/to/bin`.

```bash
# Install dependencies
npm install --ignore-scripts

# Start dev server
node node_modules/next/dist/bin/next dev

# Type check
node node_modules/typescript/bin/tsc --noEmit

# Build
node node_modules/next/dist/bin/next build
```

Open [http://localhost:3000](http://localhost:3000).

**Search:** Press `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) to open the search modal.

---

## Content Sections — current state

| Section | Status | Count |
|---|---|---|
| Docs | Active | Growing |
| Systems | Active | Growing |
| Labs | Active | Growing |
| Case Studies | Active | Growing |
| Playbooks | Active | Growing |

---

## Roadmap

### Phase 1 — Foundation ✅
- [x] Core content system — MDX, frontmatter, routing
- [x] Five sections: Docs, Systems, Labs, Case Studies, Playbooks
- [x] Sidebar layout — desktop sticky, mobile drawer
- [x] Search — Fuse.js, Cmd+K modal, `/api/search` endpoint
- [x] Custom MDX components — Callout, WorkflowBlock, PromptBlock, CodeBlock, StepList
- [x] SEO — sitemap.xml, robots.txt, OpenGraph, Twitter cards
- [x] Design system — dark-first, brand orange, dot-grid texture

### Phase 2 — Polish 🚧
- [ ] Sticky table of contents with IntersectionObserver
- [ ] Reading progress bar
- [ ] Previous / next article navigation
- [ ] Media components — YouTube, Video, Before/After, Gallery
- [ ] Search improvements — grouped results, term highlighting
- [ ] Framer Motion page and component animations
- [ ] Premium homepage — featured content, animated stats

### Phase 3 — Platform
- [ ] Tag filtering on section indexes
- [ ] Full-text search with content body
- [ ] Interactive lab tools (GEO analyzer, prompt tester)
- [ ] GitHub Actions for type-checking and build validation
- [ ] Deployment to Vercel (when ready)

### Phase 4 — AI Tools
- [ ] Embedded GEO analysis tool
- [ ] Prompt testing interface
- [ ] Live WordPress audit integration
- [ ] AI-assisted content creation workflow

---

## Properties

This knowledge base documents work across three A Square Solutions properties:

| Property | URL | Description |
|---|---|---|
| Main site | [asquaresolution.com](https://asquaresolution.com) | AI services, SEO engineering, GEO consulting |
| TrustSeal | [trustseal.in](https://trustseal.in) | Website trust verification |
| ScamCheck | [scamcheck.in](https://scamcheck.in) | Scam detection tool |

---

## Status

**Phase: Local development only.**

Not deployed. No auth. No monetization. Building the foundation correctly before scaling.

---

*A Square Solutions · [asquaresolution.com](https://asquaresolution.com)*

<!-- redeploy: vercel.json schema fix (c8989a5) -->

<!-- redeploy: fresh vercel deployment after schema fix -->
