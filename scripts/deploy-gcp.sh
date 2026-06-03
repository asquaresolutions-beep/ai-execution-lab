#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# scripts/deploy-gcp.sh — end-to-end GCP build, run in an AUTHENTICATED
# environment (e.g. Google Cloud Shell). Idempotent + serverless + scale-to-zero.
#
#   PROJECT=ass-youtube-agent NEXT_PUBLIC_SITE_URL=https://your-domain \
#     bash scripts/deploy-gcp.sh
#
# Consumes meaningful credits via REAL Vertex embeddings + (optional) Pro-tier
# generation + Cloud Run, with a daily budget breaker so it never overruns.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT="${PROJECT:-ass-youtube-agent}"
REGION="${REGION:-us-central1}"
DATASET="${BQ_DATASET:-asquare_ai}"
SITE="${NEXT_PUBLIC_SITE_URL:-https://lab.asquaresolution.com}"
ADMIN="${ADMIN_API_TOKEN:-$(openssl rand -hex 16)}"
CRON="${CRON_SECRET:-$(openssl rand -hex 16)}"
SA="asquare-ai@${PROJECT}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT"

echo "▶ 1/7 enable services"
gcloud services enable run.googleapis.com aiplatform.googleapis.com bigquery.googleapis.com \
  cloudscheduler.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

echo "▶ 2/7 service account + roles (idempotent)"
gcloud iam service-accounts create asquare-ai 2>/dev/null || true
for r in aiplatform.user bigquery.dataEditor bigquery.jobUser run.invoker; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="roles/$r" --quiet >/dev/null
done

echo "▶ 3/7 live embeddings → BigQuery (real Vertex inference)"
export VERTEX_ACCESS_TOKEN="$(gcloud auth print-access-token)"
export GCP_PROJECT="$PROJECT" BQ_DATASET="$DATASET" VERTEX_LOCATION="$REGION"
node scripts/gen-embeddings-to-bigquery.mjs

echo "▶ 4/7 vector index (cosine, IVF)"
bq query --use_legacy_sql=false \
  "CREATE VECTOR INDEX IF NOT EXISTS embeddings_idx ON \`${PROJECT}.${DATASET}.embeddings\`(embedding) OPTIONS(index_type='IVF', distance_type='COSINE')" || \
  echo "  (index optional; VECTOR_SEARCH brute-forces small tables)"

echo "▶ 5/7 deploy Cloud Run (scale-to-zero)"
gcloud run deploy asquare-ai --source . --region "$REGION" --service-account "$SA" \
  --set-env-vars "VERTEX_PROJECT_ID=$PROJECT,VERTEX_LOCATION=$REGION,BIGQUERY_PROJECT_ID=$PROJECT,BIGQUERY_DATASET=$DATASET,DEEP_TIER=flash,DAILY_BUDGET_USD=2,ADMIN_API_TOKEN=$ADMIN,CRON_SECRET=$CRON,NEXT_PUBLIC_SITE_URL=$SITE" \
  --min-instances 0 --max-instances 3 --cpu 1 --memory 1Gi --allow-unauthenticated --quiet
URL=$(gcloud run services describe asquare-ai --region "$REGION" --format='value(status.url)')

echo "▶ 6/7 scheduler (autopilot daily, drain 6-hourly)"
gcloud scheduler jobs create http asquare-autopilot --location "$REGION" --schedule="0 6 * * *" \
  --uri="$URL/api/cron/autopilot" --http-method=GET --headers="Authorization=Bearer $CRON" --quiet 2>/dev/null || true
gcloud scheduler jobs create http asquare-drain --location "$REGION" --schedule="0 */6 * * *" \
  --uri="$URL/api/cron/drain-queue" --http-method=GET --headers="Authorization=Bearer $CRON" --quiet 2>/dev/null || true

echo "▶ 7/7 verify live endpoints"
echo "-- health --"; curl -s "$URL/api/health" | head -c 300; echo
echo "-- trustscore (live Vertex) --"; curl -s -X POST "$URL/api/trustscore" -H 'content-type: application/json' \
  -d '{"input":"URGENT: share the OTP to unblock your bank account http://bit.ly/x"}' | head -c 400; echo
echo "-- semantic search (BigQuery VECTOR_SEARCH) --"; curl -s "$URL/api/semantic-search?q=how%20to%20appear%20in%20AI%20Overviews&k=5"; echo
echo "-- row count --"; bq query --use_legacy_sql=false "SELECT COUNT(*) AS n, COUNT(DISTINCT source_type) AS types FROM \`${PROJECT}.${DATASET}.embeddings\`"

cat <<EONOTE

✓ Done. Service: $URL
  ADMIN_API_TOKEN=$ADMIN
  CRON_SECRET=$CRON   (save these)
Spend: real Vertex embeddings (~₹5) + Cloud Run (scale-to-zero) + BigQuery (free tier).
To consume more meaningfully: set DEEP_TIER=pro and run a batch of /api/trustscore + /api/cron/autopilot.
Track: $URL/ops/analytics  +  GCP Billing → Budgets. Budget breaker: DAILY_BUDGET_USD.
EONOTE
