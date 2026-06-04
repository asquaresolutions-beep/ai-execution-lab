// ─────────────────────────────────────────────────────────────────
// lib/i18n/scamcheck.ts
// Lightweight UI localization for the ScamCheck analyzer (English / Hindi /
// Spanish). Dictionary-only — no i18n framework, keeps the bundle small and
// the page static. Falls back to English for any missing key.
// ─────────────────────────────────────────────────────────────────

export type Lang = 'en' | 'hi' | 'es'
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' }, { code: 'hi', label: 'हिन्दी' }, { code: 'es', label: 'Español' },
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
  es: {
    headline: '¿Este mensaje es una estafa?',
    sub: 'Sube una captura de un SMS, WhatsApp, UPI o mensaje bancario sospechoso. Leemos el texto, detectamos señales de fraude y lo comparamos con campañas de estafa conocidas.',
    dropzone: 'Arrastra y suelta una captura, toca para elegir, o pega (Ctrl/Cmd+V)',
    formats: 'PNG / JPEG / WebP · máx 6 MB · optimizado en tu dispositivo · procesado de forma segura, no se almacena',
    ctaUpload: 'Subir captura',
    ctaWhatsApp: 'Analizar captura de WhatsApp',
    ctaSms: 'Escanear captura de SMS bancario',
    compressing: 'Optimizando imagen…',
    uploading: 'Subiendo…',
    analyzing: 'Analizando captura…',
    whatToDo: 'Qué hacer',
    extracted: 'Extraído',
    fraudSignals: 'Señales de fraude',
    similar: 'Patrones de estafa conocidos similares',
    reportLabel: 'Repórtalo',
    disclaimer: 'Evaluación de riesgo automatizada; no es asesoramiento legal ni financiero.',
  },
}

export function t(lang: Lang, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key
}
