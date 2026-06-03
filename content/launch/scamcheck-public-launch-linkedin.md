# ScamCheck public launch — LinkedIn notes

Draft, human-sounding posts for the public ScamCheck launch. No emojis, no
hype, no AI-tells. Review and post manually (do not auto-publish).

---

## Option A — the build (founder/技术 voice)

Most scam advice is "be careful." That doesn't help when a fake SBI KYC message is staring at you at 11pm.

So we built ScamCheck differently: you paste a screenshot, it reads the text, pulls out the URLs, UPI IDs and phone numbers, checks the domain for look-alikes and shorteners, and tells you what it found — and why.

It runs on Cloud Run (scale-to-zero), uses Vertex AI for OCR + vision, and compares each upload against a vector corpus of known scam campaigns so you can see if it matches something already circulating.

Public scam intelligence pages are live too — fake SBI KYC, UPI refund, courier customs, Telegram investment — with the red flags spelled out.

Try a screenshot: <URL>/scamcheck/screenshot

---

## Option B — the public-good angle

A quick PSA, because this one keeps catching people:

If a "refund" asks you to scan a QR code or approve a UPI collect request — stop. In UPI, scanning a QR or entering your PIN SENDS money. It never receives it. There is no such thing as a refund you have to "approve".

We wrote up the common ones (fake KYC, UPI refund, courier customs, Telegram investment) with the exact red flags, and built a tool where you can check a suspicious screenshot in a few seconds.

Read + check: <URL>/scam-intelligence

---

## Option C — short, shareable

New: paste a screenshot of any suspicious SMS/WhatsApp/UPI message and get an instant read — extracted links, spoofed-brand check, scam category, and similar known campaigns.

Built on Vertex AI + Cloud Run, free to use, mobile-first.

<URL>/scamcheck/screenshot

---

### First comment (for any of the above)
The intelligence pages explain how each scam works and what to do if you have already shared details (call 1930 / cybercrime.gov.in). Links: <URL>/scam-intelligence

### Posting checklist
- Replace <URL> with the production domain.
- Post Option A or B as the main post; keep Option C for reposts.
- Add 1 real screenshot of the tool (not a mockup).
- Reply to early comments with the specific intelligence page that matches their question.
