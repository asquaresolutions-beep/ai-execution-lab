#!/usr/bin/env node
// Publishes the ScamCheck AI scam-intelligence post to LinkedIn.
// Token read from .env.local (LINKEDIN_ACCESS_TOKEN) — never hardcoded/printed.
// Usage: node scripts/linkedin-post-scamcheck.mjs [--validate] [--dry-run]
import { loadToken, getProfile, publishPost } from './linkedin-util.mjs'

const POST = `A fake "SBI KYC suspended" SMS doesn't care that you're an engineer. At 11pm, it works on everyone.

So we built ScamCheck: paste a screenshot of a suspicious SMS / WhatsApp / UPI message and get an instant, explainable read — extracted links, UPI IDs and phone numbers, spoofed-brand and look-alike-domain checks, a scam category, and the most similar known scam campaigns.

It runs on Vertex AI + BigQuery VECTOR_SEARCH on Cloud Run (scale-to-zero), with multilingual embeddings so Hindi, Hinglish and "KYC update karo warna account block ho jayega" are first-class, not afterthoughts.

A few things that were harder than expected:

1) Vector dimension drift is silent until it isn't. A query embedded at one dimensionality against a corpus embedded at another fails deep inside VECTOR_SEARCH, not at the API edge. We pinned one canonical model + 768 dims everywhere and added a diagnostics endpoint so the system reports the real numbers instead of guessing.

2) Your corpus quality is your ceiling. Our first ingestion happily embedded Cloudflare "Checking your browser…" pages instead of article text. Confident garbage out. We moved to structured sources + a hard content-quality gate.

3) Multilingual precision is a knife fight. "Do not share your OTP" (a real bank) and "share the OTP" (a scam) are one token apart. Naive keyword rules flag both. Calibration + intent-aware patterns got us to zero false positives across 500 legitimate messages.

4) Cloud Run cold starts break naive auth. An ADC token fetch on a cold instance can exceed a tight timeout and surface as "no credentials" — which is a lie. Retry plus an honest error message mattered more than the happy path.

Where it stands on a 1,000-sample multilingual evaluation corpus: precision 1.00, recall 0.934. The misses are mostly pure-Hindi, no-URL messages — the next thing to close.

The hard part of fraud detection isn't the model. It's the unglamorous infrastructure around it: dimensions, schema drift, retrieval quality, and telling the user the truth when you're not sure.

If you want to try it on a screenshot: scamcheck.asquaresolution.com

#AIInfrastructure #VectorSearch #FraudDetection #VertexAI #CyberSecurity #SemanticSearch #BigQuery #TrustAndSafety`

const token = loadToken()
const profile = await getProfile(token)
console.error(`token OK · ${profile.displayName} · ${profile.authorUrn} · post ${POST.length} chars`)
if (process.argv.includes('--validate')) process.exit(0)
if (process.argv.includes('--dry-run')) { console.error('DRY RUN — not published'); process.exit(0) }
const r = await publishPost(token, profile.authorUrn, POST)
console.log(JSON.stringify({ ok: true, postUrl: r.postUrl, postUrn: r.postUrn }))
