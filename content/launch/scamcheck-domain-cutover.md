# scamcheck.asquaresolution.com — origin cutover runbook

## Current architecture (audited live, read-only)
- **Origin: GitHub Pages (static).** `Server: GitHub.com`, Fastly/varnish edge,
  CNAME `scamcheck.asquaresolution.com → asquaresolutions-beep.github.io`.
- It is a **separate static repo** (subdomain → GitHub Pages mapping), NOT Vercel,
  NOT Cloud Run, NOT a reverse proxy.
- Indexed URLs today: `/`, `/scam-alerts`, `/types-of-scams`, `/how-to-report`,
  `/protect-yourself`, `/contact`, `/privacy-policy`, `/terms` (+ `/result`, noindex).

## Why the new UI can't go on the current origin
The new ScamCheck experience is a **dynamic Next.js app**: the analyzer calls
server API routes (`/api/scam-intel/screenshot`, `/api/geo`) that run Vertex AI
OCR/vision + BigQuery VECTOR_SEARCH. **GitHub Pages is static-only** — no server,
no API routes, no Node. And `x-vercel-ip-country` only exists on a **Vercel**
origin. So the subdomain's **origin must move** from GitHub Pages to a dynamic
host (Vercel recommended; this repo already has `vercel.json`).

## Recommended target: a dedicated Vercel project for the scamcheck domain
Keeps the scamcheck product surface focused and keeps lab off the public domain.

### 1. Deploy this app to a Vercel project
- Import `asquaresolutions-beep/ai-execution-lab` into Vercel (or reuse the project).
- Production branch: `master` (merge the feature branch first — see below).
- Env (Project → Settings → Environment Variables, Production):
  - `NEXT_PUBLIC_SITE_URL = https://scamcheck.asquaresolution.com` (canonical host)
  - `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, BigQuery + ADC vars as in
    `content/docs/gcp-ai-infrastructure.mdx`.

### 2. Merge the UI to the production branch
```bash
gh pr merge feat/scamcheck-growth-engine --squash   # PR #1
# or: git checkout master && git merge feat/scamcheck-growth-engine && git push origin master
```

### 3. Attach the domain to the Vercel project
- Vercel → Project → Settings → Domains → add `scamcheck.asquaresolution.com`.
- Vercel shows the required DNS target.

### 4. Change DNS (the actual origin cutover)
At the DNS provider, change the `scamcheck` record:
```
# BEFORE
scamcheck  CNAME  asquaresolutions-beep.github.io
# AFTER
scamcheck  CNAME  cname.vercel-dns.com            # value Vercel gives you
```
Propagation is usually minutes. The old GitHub Pages repo can stay as a backup
until verified.

### 5. SEO preservation (already coded)
- `middleware.ts` (host-scoped to `scamcheck.*`):
  - serves the analyzer at `/` (root experience),
  - 301s `/scam-alerts`, `/types-of-scams`, `/how-to-report`, `/protect-yourself`
    → `/scam-intelligence`.
- **Recreate before cutover** (the new app doesn't have them): `/privacy-policy`,
  `/terms`, `/contact`. Do NOT let these 404 — add 301s or real pages.
- `NEXT_PUBLIC_SITE_URL` makes all canonicals/sitemap use the scamcheck host.
- After cutover: resubmit `https://scamcheck.asquaresolution.com/sitemap.xml` in
  Google Search Console; keep the property; watch Coverage for new vs removed URLs.

## Verification (after DNS propagates)
```bash
PROD=https://scamcheck.asquaresolution.com
curl -sI "$PROD/" | grep -i "server\|x-vercel-id"          # expect Vercel, not GitHub.com
curl -s "$PROD/" | grep -o "Upload screenshot"             # analyzer at root
curl -s -o /dev/null -w "%{http_code}\n" "$PROD/scam-alerts"   # expect 301
curl -s "$PROD/api/geo" -H "x-vercel-ip-country: DE"        # geo header path
curl -s "$PROD/scam-intelligence/upi-scams-india" | grep -o "<title>[^<]*"
```

## Blockers I cannot clear from here (need your access)
- DNS change (registrar), Vercel domain attach + env, and the PR merge — all
  require credentials I don't have.
- I cannot browse/screenshot production to do the manual visual verification.
- Decision needed: recreate `/privacy-policy`, `/terms`, `/contact` on the new
  app, or 301 them (I left them out of the auto-redirects to avoid losing legal
  pages without your sign-off).
