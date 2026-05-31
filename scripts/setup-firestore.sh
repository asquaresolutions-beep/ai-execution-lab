#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# scripts/setup-firestore.sh
# One-time Firestore setup for AI Execution Lab production.
# Prereqs: firebase-tools + gcloud CLIs authenticated to the project.
#
#   FIREBASE_PROJECT_ID=your-project ./scripts/setup-firestore.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

: "${FIREBASE_PROJECT_ID:?Set FIREBASE_PROJECT_ID}"

echo "▶ Regenerating index definitions from schema…"
node scripts/gen-firestore-indexes.mjs

echo "▶ Deploying composite indexes (firestore.indexes.json)…"
firebase deploy --only firestore:indexes --project "$FIREBASE_PROJECT_ID"

echo "▶ Creating vector indexes (gcloud)…"
bash scripts/setup-vector-indexes.sh

echo "▶ Configuring TTL policies for ephemeral collections…"
gcloud firestore fields ttls update expiresAt \
  --collection-group=_ai_cache --project "$FIREBASE_PROJECT_ID" --async || true
gcloud firestore fields ttls update resetAt \
  --collection-group=_rate_limits --project "$FIREBASE_PROJECT_ID" --async || true

echo "✓ Firestore setup complete."
echo "  Composite indexes may take several minutes to build."
echo "  Verify: firebase firestore:indexes --project $FIREBASE_PROJECT_ID"
