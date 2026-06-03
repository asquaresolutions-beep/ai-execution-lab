# ScamCheck evaluation datasets

Labeled samples for benchmarking the multimodal ScamCheck pipeline.

```
datasets/
  scam-samples/manifest.json    # 8 scam samples (en + Hinglish)
  legit-samples/manifest.json   # 8 legitimate samples (incl. scam-adjacent keywords)
```

Each sample is the **OCR text** a real screenshot would yield (we store text, not
binary images, so the corpus is diff-able, reviewable, and runnable offline).
Channels covered: WhatsApp, SMS, email, app. Categories: phishing, KYC fraud,
UPI/refund fraud, OTP fraud, courier/customs, fake job — plus legit OTP, banking
notifications, courier updates, ecommerce receipts, and payment-success screens.
The legit set deliberately includes scam-adjacent keywords (OTP, KYC, payment)
to measure **false positives** and exercise the calibration layer.

## Run the benchmark (no mocks)

```bash
# Offline: runs the REAL deterministic detection + entity + calibration layer
node scripts/benchmark-scamcheck.mjs

# Live (also exercises OCR/Vertex/VECTOR_SEARCH): point at a deployed instance
SCAMCHECK_URL=https://<cloud-run-url> node scripts/benchmark-scamcheck.mjs --live
```

Reports precision, recall, F1, FP/FN, and entity-extraction accuracy. OCR
accuracy, semantic-retrieval relevance, and hallucination rate require a live
run with real image files + Vertex (documented in the script output).

## Adding real screenshots

Drop a base64 of any screenshot into `/api/scam-intel/screenshot` to score it
live. To add to the labeled set, append `{ id, channel, lang, category, ocrText,
expectEntities }` to the appropriate manifest and re-run the benchmark.
