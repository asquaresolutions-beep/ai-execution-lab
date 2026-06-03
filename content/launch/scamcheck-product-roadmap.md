# ScamCheck — Production Roadmap

ScamCheck is becoming a standalone consumer scam-detection product (by A Square
Solutions). Current state: tabbed quick analyzer (message/link/email/phone) +
AI screenshot analyzer, multilingual detection, reputation layer, client credits
+ Firebase auth (email + Google), trusted-domain handling, ad slots reserved,
SEO pages. This roadmap sequences the next milestones.

## Now → next (hardening of what shipped)
- **Server-side credit enforcement.** Client ledger is a soft limit. Verify the
  Firebase ID token in the API routes, enforce per-user daily quotas in
  Firestore/BigQuery, and rate-limit by uid (not just IP). *(Blocks abuse + paid plans.)*
- **AdSense activation.** Set `NEXT_PUBLIC_ADSENSE_CLIENT`; swap `AdSlot`
  placeholders for `<ins>` units on intelligence/article/result pages only.
- **Auth env.** Set `NEXT_PUBLIC_FIREBASE_API_KEY` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  (Google login) on the scamcheck Vercel project.

## M1 — Accounts & history (4–6 wks)
- User accounts (done: email + Google). Add password reset, email verification.
- **Saved history**: persist each scan (verdict, type, timestamp) per uid in
  Firestore; "My scans" page; export.
- Trust feedback loop: thumbs up/down on verdicts → tune detectors + reputation.

## M2 — Scam reporting (4–6 wks)
- "Report this scam" flow → writes to the existing scam-intel ingest +
  `scam_corpus`; community-sourced campaign detection.
- Public, moderated scam feed; contributor reputation; abuse controls.

## M3 — Email scanning (6–8 wks)
- Forward-to-scan inbox (e.g. report@scamcheck…) + Gmail add-on / OAuth read-only
  scan of a selected message. Header/SPF/DKIM/DMARC checks + the existing
  text/link/reputation pipeline. Strict privacy posture (no storage).

## M4 — Browser extension (6–8 wks)
- MV3 extension: right-click "Check with ScamCheck" on a link/selection; inline
  badges on suspicious links in webmail/WhatsApp Web; calls the public quick-check
  API with per-key quotas. Chrome + Edge first, then Firefox.

## M5 — Premium plans (with M1/server credits)
- Tiers: Free (current), Pro (higher quotas, history, priority vision, no ads),
  Business (team, API, bulk). Billing via Razorpay/Stripe. Premium unlocks
  deep-vision on every scan + email scanning.

## M6 — API access
- Public REST API (the existing `/api/scam-intel/*` hardened) with API keys,
  usage metering, and docs. Webhooks for report feeds. Drives B2B revenue.

## M7 — Multilingual expansion
- Beyond en/hi/hinglish: Tamil, Telugu, Bengali, Marathi, plus SEA languages
  for Singapore/Indonesia. Localized detectors + UI + geo SEO pages per market
  (the `countries.ts` + `intel-pages.ts` patterns already generalize).

## Ad monetization strategy
- **Where:** intelligence/article pages + result pages only — never adjacent to
  the upload button or trust verdict UI (enforced by component placement).
- **What:** AdSense display first; later, contextual safety-product affiliates
  (antivirus, identity protection) on high-intent scam pages.
- **Guardrails:** no ads for free users *during* a scan; Pro removes ads;
  reserved slot heights prevent CLS (already implemented in `AdSlot`).
- **Revenue mix target:** ads (volume) + Pro subscriptions (LTV) + API/B2B (margin).

## Cross-cutting
- Observability: per-scan latency/cost already emitted; add funnel analytics
  (scan → result → sign-up → Pro).
- Trust & safety: keep "images not stored", publish the privacy posture, and
  keep the reputation allowlist current.
