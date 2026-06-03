// ─────────────────────────────────────────────────────────────────
// lib/i18n/scamcheck.ts
// Lightweight UI localization for the ScamCheck analyzer (English / Hindi /
// Hinglish). Dictionary-only — no i18n framework, keeps the bundle small and
// the page static. Falls back to English for any missing key.
// ─────────────────────────────────────────────────────────────────

export type Lang = 'en' | 'hi' | 'hinglish'
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' }, { code: 'hi', label: 'हिन्दी' }, { code: 'hinglish', label: 'Hinglish' },
]

type Dict = Record<string, string>
const STRINGS: Record<Lang, Dict> = {
  en: {
    headline: 'Is this message a scam?',
    sub: 'Upload a screenshot of a suspicious SMS, WhatsApp, UPI, or banking message. We read the text, flag fraud signals, and check it against known scam campaigns.',
    dropzone: 'Drag & drop a screenshot, tap to choose, or paste (Ctrl/Cmd+V)',
    formats: 'PNG / JPEG / WebP · max 6 MB · optimized on your device · processed securely, not stored',
    ctaUpload: 'Upload screenshot',
    ctaWhatsApp: 'Analyze WhatsApp screenshot',
    ctaSms: 'Scan banking SMS screenshot',
    compressing: 'Optimizing image…',
    uploading: 'Uploading…',
    analyzing: 'Analyzing screenshot…',
    whatToDo: 'What to do',
    extracted: 'Extracted',
    fraudSignals: 'Fraud signals',
    similar: 'Similar known scam patterns',
    reportLabel: 'Report it',
    disclaimer: 'Automated risk assessment, not legal or financial advice.',
  },
  hi: {
    headline: 'क्या यह संदेश एक स्कैम है?',
    sub: 'किसी संदिग्ध SMS, WhatsApp, UPI या बैंकिंग संदेश का स्क्रीनशॉट अपलोड करें। हम टेक्स्ट पढ़ते हैं, धोखाधड़ी के संकेत पकड़ते हैं और ज्ञात स्कैम से मिलान करते हैं।',
    dropzone: 'स्क्रीनशॉट यहाँ खींचें, चुनने के लिए टैप करें, या पेस्ट करें (Ctrl/Cmd+V)',
    formats: 'PNG / JPEG / WebP · अधिकतम 6 MB · आपके डिवाइस पर ऑप्टिमाइज़ · सुरक्षित, संग्रहीत नहीं',
    ctaUpload: 'स्क्रीनशॉट अपलोड करें',
    ctaWhatsApp: 'WhatsApp स्क्रीनशॉट जाँचें',
    ctaSms: 'बैंकिंग SMS स्क्रीनशॉट जाँचें',
    compressing: 'इमेज ऑप्टिमाइज़ हो रही है…',
    uploading: 'अपलोड हो रहा है…',
    analyzing: 'स्क्रीनशॉट का विश्लेषण…',
    whatToDo: 'क्या करें',
    extracted: 'निकाली गई जानकारी',
    fraudSignals: 'धोखाधड़ी संकेत',
    similar: 'मिलते-जुलते ज्ञात स्कैम',
    reportLabel: 'रिपोर्ट करें',
    disclaimer: 'स्वचालित जोखिम आकलन, कानूनी या वित्तीय सलाह नहीं।',
  },
  hinglish: {
    headline: 'Kya yeh message scam hai?',
    sub: 'Kisi suspicious SMS, WhatsApp, UPI ya banking message ka screenshot upload karein. Hum text padhte hain, fraud signals pakadte hain, aur known scams se match karte hain.',
    dropzone: 'Screenshot drag karein, choose karne ke liye tap karein, ya paste karein (Ctrl/Cmd+V)',
    formats: 'PNG / JPEG / WebP · max 6 MB · device par optimize · secure, store nahi hota',
    ctaUpload: 'Screenshot upload karein',
    ctaWhatsApp: 'WhatsApp screenshot check karein',
    ctaSms: 'Banking SMS screenshot scan karein',
    compressing: 'Image optimize ho rahi hai…',
    uploading: 'Upload ho raha hai…',
    analyzing: 'Screenshot analyze ho raha hai…',
    whatToDo: 'Kya karein',
    extracted: 'Extracted',
    fraudSignals: 'Fraud signals',
    similar: 'Milte-julte known scams',
    reportLabel: 'Report karein',
    disclaimer: 'Automated risk assessment hai, legal/financial advice nahi.',
  },
}

export function t(lang: Lang, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key
}
