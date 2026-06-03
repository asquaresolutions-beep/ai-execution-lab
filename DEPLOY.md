# Deployment — `feat/scamcheck-growth-engine`

Deploy guide for the Vertex AI migration, autonomous scam-alert pipeline, and programmatic SEO engine. Target: **Vercel (hobby-compatible) + Firestore + Vertex AI**.

---

## 1. Architecture summary

```
                ┌──────────────── Next.js app (Vercel) ────────────────┐
                │                                                       │
  Public  ──►  /api/scam-intel/ingest ──► ingestion pipeline           │
                │   redact PII → spam → classify(rule+Vertex) → embed   │
                │   → dedup/cluster → severity → moderate → store       │
                │                                                       │
  Cron    ──►  /api/cron/autopilot ──► freshness rank → dedup →         │
                │   generateBundle (Flash + Pro) → queue publish+Shorts │
  Cron    ──►  /api/cron/drain-queue ─► publish (throttled) → DLQ       │
  Cron    ──►  /api/cron/update-trending, /api/cron/clean-cache         │
                │                                                       │
  SSG     ──►  /scams/[[...slug]]  (≈250 static pages, 0 AI/0 DB)       │
  Admin   ──►  /ops/{distribution,scam-intel,analytics}, /api/health    │
                └───────────────────────────────────────────────────────┘
   AI:  lib/ai/provider.ts → Vertex AI (Gemini 2.5 Flash/Pro) | mock fallback
   Data: lib/store → Firestore REST (prod) | MemoryStore (dev)
```

- **AI** is provider-abstracted; Vertex tiers (Flash default, Pro for the deep article) with auto-fallback + backoff. Mock fallback when unconfigured.
- **Persistence** is interface-abstracted; Firestore in prod via REST (no SDK), MemoryStore otherwise.
- **Programmatic SEO** is fully static (build-time), zero runtime AI/DB cost.
- **Cost/quota/usage** tracked via increment counters; surfaced on `/ops/analytics`.

## 2. Deployment checklist

1. **Merge/deploy branch** `feat/scamcheck-growth-engine`.
2. **Set env vars** in Vercel (see §4) for Production (and Preview if testing).
3. **Service account**: create, grant `roles/aiplatform.user`; enable the **Vertex AI API**; enable **Firestore**.
4. **Firestore indexes**: `FIREBASE_PROJECT_ID=… npm run setup:firestore` (composite + vector indexes + TTL policies). Wait for build to finish.
5. **Deploy** (push to Vercel). Crons auto-register from `vercel.json`.
6. **Smoke**: `curl https://<site>/api/health` → expect `"ai":"live"`, `"persistence":"firestore"`, `env.ok:true`.
7. **Generate one bundle** (admin) → confirm tokens/cost on `/ops/analytics`.
8. **Search Console**: submit `/sitemap.xml`; request indexing for a few tier-1 scam pages.
9. **Verify** a few `/scams/...` pages render with FAQ/Article schema (Rich Results Test).

## 3. Rollback notes

- **Code**: revert by redeploying the previous Vercel deployment (instant) or `git revert` the merge; commits are themed so a single workstream can be reverted in isolation (`feat(programmatic-seo)`, `feat(vertex-ai)`, etc.).
- **Crons**: remove/disable in `vercel.json` and redeploy to halt all autonomous activity immediately.
- **AI cutover**: unset `VERTEX_PROJECT_ID` / Vertex auth → provider falls back to **mock** (no spend, no crash). Safe kill-switch.
- **Persistence**: unset Firebase vars → MemoryStore (non-persistent) — use only to isolate a Firestore incident, not for prod data.
- **Programmatic pages**: purely additive + static; deleting `app/scams` and the sitemap import fully removes them with no data impact.
- **No destructive migrations**: nothing drops/rewrites existing data; all collections are new or append-only.

## 4. Environment requirements

**Required for live production:**
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | canonical URLs, schema, sitemap |
| `VERTEX_PROJECT_ID` | Vertex AI project (falls back to `FIREBASE_PROJECT_ID`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` *or* `VERTEX_ACCESS_TOKEN` | Vertex auth (`roles/aiplatform.user`) |
| `FIREBASE_PROJECT_ID` | Firestore project |
| `FIREBASE_API_KEY` *or* `FIREBASE_ACCESS_TOKEN` | Firestore auth |
| `ADMIN_API_TOKEN` | gates admin routes + dashboard data |
| `CRON_SECRET` | authenticates Vercel cron calls |

**Optional (sensible defaults):** `VERTEX_LOCATION` (us-central1), `VERTEX_FLASH_MODEL`, `VERTEX_PRO_MODEL`, `VERTEX_EMBED_MODEL`, `DEEP_TIER` (pro), `VERTEX_TOKENS_PER_MIN`, `AUTOPILOT_PER_RUN`, `BUNDLES_PER_DAY`, `PUBLISH_PER_HOUR`, `AUTOPILOT_REGION`, `NEXT_PUBLIC_SCAM_BASE_URL`, `LOG_LEVEL`. Full template in `.env.example`.

> Secrets live **only** in Vercel env settings. `.env.local` is git-ignored; nothing secret is committed.

## 5. Cost-sensitive deployment notes

- **Programmatic SEO = $0** ongoing (static, deterministic). Only build time grows (~250 pages prerender in seconds).
- **Cheap-mode switch**: `DEEP_TIER=flash` cuts article cost ~4× (Flash instead of Pro).
- **Throttle caps**: `BUNDLES_PER_DAY` (20), `PUBLISH_PER_HOUR` (12), `AUTOPILOT_PER_RUN` (3) bound spend; raise gradually.
- **Cache + dedup** typically remove 30–60% of generations (re-runs / near-duplicates).
- **Crons are hobby-friendly** (daily); drain early-exits when the queue is empty (near-free ticks). On Pro, tighten drain to `*/10` and autopilot to hourly.
- **Firestore**: hot paths use increment counters, not scans; TTL policies auto-prune `_ai_cache` / `_rate_limits`. Stays within Spark free tier at low volume; set a **Cloud Billing budget alert**.
- **Pricing constants in `lib/ai/usage.ts` are estimates** — confirm against the Vertex pricing page and override via `VERTEX_*_PER_M`.
- Estimated monthly total: **~$0.30–$8** (idle→light), **~$15–$55** (active). See `content/docs/low-cost-autonomous-operation.mdx`.
