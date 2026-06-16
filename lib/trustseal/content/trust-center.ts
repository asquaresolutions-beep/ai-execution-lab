// lib/trustseal/content/trust-center.ts  (asq-trustseal-phase3)
// Fully-localized Trust Center — the authority hub: methodology, verification
// standards, trust framework, and the signal library. Indexable; linked from the
// footer and docs. Built on the shared ContentPageView (TOC enabled).
import type { LocalizedPage } from './types'

export const trustCenterContent: LocalizedPage = {
  en: {
    title: 'Trust Center',
    subtitle: 'How TrustSeal measures trust: the methodology, standards, framework, and the signals behind every score.',
    sections: [
      { heading: 'Trust methodology', paras: ['TrustSeal converts verifiable evidence into an explainable trust score (0–100) and a trust band. We start from proven domain ownership, then evaluate independent signal categories and combine their sub-scores under published weights. Every score is explainable: the public seal page shows the per-category breakdown and the per-signal evidence behind it.'] },
      { heading: 'Verification standards', bullets: [
        'Ownership is proven cryptographically via a unique per-claim DNS TXT token — not self-assertion.',
        'The first account to verify a domain owns it within TrustSeal; tokens expire.',
        'Verdicts are server-authoritative and re-checked over time; clients cannot alter their own score or band.',
        'Clean verdicts are cached briefly and risky verdicts longer, so a freshly-weaponized domain cannot hide behind a stale good score.',
      ] },
      { heading: 'Trust framework (the five bands)', bullets: [
        'Verified — ownership confirmed, signals strong.',
        'Established — solid, consistent reputation history.',
        'Limited — verified but with thin or new signals.',
        'Caution — anomalies detected; review before transacting.',
        'Risk — blocklist or impersonation signals; high risk.',
      ] },
      { heading: 'Signal library', paras: ['Signals are grouped into categories, each contributing a sub-score:'], bullets: [
        'DNS — resolution, mail (MX), and email-auth records.',
        'SSL/TLS — certificate validity, validation level, and age.',
        'Reputation — blocklist providers and intelligence-graph signals.',
        'WHOIS — domain age and registration data (where available).',
        'Impersonation — look-alike / brand-impersonation patterns.',
        'Legitimacy & web — site presence and consistency signals.',
      ] },
      { heading: 'Confidence & coverage', paras: ['Each verdict carries a confidence level reflecting how much signal coverage was available. A partial verdict (some categories not yet assessed) is labelled as such — TrustSeal never implies more certainty than the evidence supports.'] },
      { heading: 'Programmatic access', paras: ['The methodology is queryable: the public Trust API (GET /api/trust/{domain}) returns the status, trust level, score, confidence, full breakdown, and signals as JSON. See the Documentation for details.'] },
    ],
  },
  hi: {
    title: 'ट्रस्ट सेंटर',
    subtitle: 'TrustSeal भरोसे को कैसे मापता है: पद्धति, मानक, ढाँचा और हर स्कोर के पीछे के संकेत।',
    sections: [
      { heading: 'ट्रस्ट पद्धति', paras: ['TrustSeal सत्यापन-योग्य प्रमाण को एक स्पष्ट ट्रस्ट स्कोर (0–100) और ट्रस्ट बैंड में बदलता है। हम सिद्ध डोमेन स्वामित्व से शुरू करते हैं, फिर स्वतंत्र संकेत श्रेणियों का मूल्यांकन करते हैं और प्रकाशित भारों के तहत उनके उप-स्कोर जोड़ते हैं। हर स्कोर स्पष्ट है: सार्वजनिक सील पेज प्रति-श्रेणी विवरण और उसके पीछे के प्रति-संकेत प्रमाण दिखाता है।'] },
      { heading: 'सत्यापन मानक', bullets: [
        'स्वामित्व एक अद्वितीय प्रति-दावा DNS TXT टोकन से क्रिप्टोग्राफ़िक रूप से सिद्ध होता है — स्व-घोषणा से नहीं।',
        'सबसे पहले सत्यापित करने वाला खाता मालिक होता है; टोकन समाप्त होते हैं।',
        'निर्णय सर्वर-आधिकारिक हैं और समय-समय पर पुनः जाँचे जाते हैं; ग्राहक अपना स्कोर/बैंड नहीं बदल सकते।',
        'स्वच्छ निर्णय थोड़े समय के लिए और जोखिमपूर्ण लंबे समय कैश होते हैं, ताकि नया हथियारीकृत डोमेन पुराने अच्छे स्कोर के पीछे न छुप सके।',
      ] },
      { heading: 'ट्रस्ट ढाँचा (पाँच बैंड)', bullets: [
        'सत्यापित — स्वामित्व पुष्ट, संकेत मजबूत।',
        'स्थापित — ठोस, सुसंगत प्रतिष्ठा इतिहास।',
        'सीमित — सत्यापित पर कम या नए संकेत।',
        'सावधानी — विसंगतियाँ; लेन-देन से पहले समीक्षा करें।',
        'जोखिम — ब्लॉकलिस्ट या प्रतिरूपण संकेत; उच्च जोखिम।',
      ] },
      { heading: 'सिग्नल लाइब्रेरी', paras: ['संकेत श्रेणियों में समूहित हैं, प्रत्येक एक उप-स्कोर देती है:'], bullets: [
        'DNS — रिज़ॉल्यूशन, मेल (MX), और ईमेल-प्रमाणन रिकॉर्ड।',
        'SSL/TLS — प्रमाणपत्र वैधता, सत्यापन स्तर और आयु।',
        'प्रतिष्ठा — ब्लॉकलिस्ट प्रदाता और इंटेलिजेंस-ग्राफ संकेत।',
        'WHOIS — डोमेन आयु और पंजीकरण डेटा (जहाँ उपलब्ध)।',
        'प्रतिरूपण — मिलते-जुलते / ब्रांड-प्रतिरूपण पैटर्न।',
        'वैधता और वेब — साइट उपस्थिति और संगति संकेत।',
      ] },
      { heading: 'विश्वास और कवरेज', paras: ['हर निर्णय में एक विश्वास स्तर होता है जो उपलब्ध संकेत कवरेज को दर्शाता है। आंशिक निर्णय (कुछ श्रेणियाँ अभी मूल्यांकित नहीं) को वैसा ही चिह्नित किया जाता है — TrustSeal प्रमाण से अधिक निश्चितता का दावा कभी नहीं करता।'] },
      { heading: 'प्रोग्रामेटिक पहुँच', paras: ['पद्धति क्वेरी-योग्य है: सार्वजनिक ट्रस्ट API (GET /api/trust/{domain}) स्थिति, ट्रस्ट स्तर, स्कोर, विश्वास, पूर्ण विवरण और संकेत JSON में लौटाता है। विवरण के लिए दस्तावेज़ देखें।'] },
    ],
  },
  es: {
    title: 'Centro de Confianza',
    subtitle: 'Cómo TrustSeal mide la confianza: la metodología, los estándares, el marco y las señales detrás de cada puntaje.',
    sections: [
      { heading: 'Metodología de confianza', paras: ['TrustSeal convierte evidencia verificable en un puntaje de confianza explicable (0–100) y una banda de confianza. Partimos de la propiedad del dominio probada, evaluamos categorías de señales independientes y combinamos sus sub-puntajes con pesos publicados. Cada puntaje es explicable: la página de sello pública muestra el desglose por categoría y la evidencia por señal.'] },
      { heading: 'Estándares de verificación', bullets: [
        'La propiedad se prueba criptográficamente con un token DNS TXT único por reclamación — no por autoproclamación.',
        'La primera cuenta que verifica es la propietaria; los tokens caducan.',
        'Los veredictos tienen autoridad en el servidor y se vuelven a comprobar con el tiempo; los clientes no pueden alterar su puntaje o banda.',
        'Los veredictos limpios se almacenan poco tiempo y los riesgosos más, para que un dominio recién comprometido no se oculte tras un buen puntaje obsoleto.',
      ] },
      { heading: 'Marco de confianza (las cinco bandas)', bullets: [
        'Verificado — propiedad confirmada, señales fuertes.',
        'Establecido — historial de reputación sólido y constante.',
        'Limitado — verificado pero con señales escasas o nuevas.',
        'Precaución — anomalías; revisa antes de operar.',
        'Riesgo — señales de lista de bloqueo o suplantación; alto riesgo.',
      ] },
      { heading: 'Biblioteca de señales', paras: ['Las señales se agrupan en categorías, cada una aporta un sub-puntaje:'], bullets: [
        'DNS — resolución, correo (MX) y registros de autenticación de correo.',
        'SSL/TLS — validez del certificado, nivel de validación y antigüedad.',
        'Reputación — proveedores de listas de bloqueo y señales del grafo de inteligencia.',
        'WHOIS — antigüedad del dominio y datos de registro (cuando están disponibles).',
        'Suplantación — patrones de imitación / suplantación de marca.',
        'Legitimidad y web — presencia del sitio y señales de consistencia.',
      ] },
      { heading: 'Confianza y cobertura', paras: ['Cada veredicto lleva un nivel de confianza que refleja cuánta cobertura de señales hubo. Un veredicto parcial (algunas categorías aún no evaluadas) se etiqueta como tal — TrustSeal nunca implica más certeza de la que la evidencia respalda.'] },
      { heading: 'Acceso programático', paras: ['La metodología es consultable: la API pública de confianza (GET /api/trust/{domain}) devuelve estado, nivel de confianza, puntaje, confianza, desglose completo y señales en JSON. Consulta la Documentación.'] },
    ],
  },
  ar: {
    title: 'مركز الثقة',
    subtitle: 'كيف يقيس TrustSeal الثقة: المنهجية والمعايير والإطار والإشارات وراء كل درجة.',
    sections: [
      { heading: 'منهجية الثقة', paras: ['يحوّل TrustSeal الأدلة القابلة للتحقق إلى درجة ثقة قابلة للتفسير (0–100) ونطاق ثقة. نبدأ من ملكية نطاق مُثبتة، ثم نقيّم فئات إشارات مستقلة ونجمع درجاتها الفرعية وفق أوزان منشورة. كل درجة قابلة للتفسير: تعرض صفحة الختم العامة التفصيل حسب الفئة والدليل لكل إشارة.'] },
      { heading: 'معايير التحقق', bullets: [
        'تُثبَت الملكية تشفيريًا برمز DNS TXT فريد لكل مطالبة — لا بالادعاء الذاتي.',
        'أول حساب يتحقق يملك النطاق؛ وتنتهي صلاحية الرموز.',
        'الأحكام ذات سلطة على الخادم ويُعاد فحصها مع الوقت؛ ولا يمكن للعملاء تغيير درجتهم أو نطاقهم.',
        'تُخزَّن الأحكام النظيفة لفترة قصيرة والخطرة لفترة أطول، حتى لا يختبئ نطاق مُسلَّح حديثًا خلف درجة جيدة قديمة.',
      ] },
      { heading: 'إطار الثقة (النطاقات الخمسة)', bullets: [
        'مُوثّق — الملكية مؤكدة والإشارات قوية.',
        'راسخ — تاريخ سمعة متين ومتسق.',
        'محدود — موثّق لكن بإشارات قليلة أو جديدة.',
        'تحذير — شذوذ؛ راجع قبل التعامل.',
        'خطر — إشارات قائمة حظر أو انتحال؛ خطر مرتفع.',
      ] },
      { heading: 'مكتبة الإشارات', paras: ['تُجمَّع الإشارات في فئات تُسهم كل منها بدرجة فرعية:'], bullets: [
        'DNS — التحليل والبريد (MX) وسجلات مصادقة البريد.',
        'SSL/TLS — صلاحية الشهادة ومستوى التحقق والعمر.',
        'السمعة — مزوّدو قوائم الحظر وإشارات رسم الذكاء.',
        'WHOIS — عمر النطاق وبيانات التسجيل (عند توفّرها).',
        'الانتحال — أنماط التشابه / انتحال العلامة التجارية.',
        'المشروعية والويب — حضور الموقع وإشارات الاتساق.',
      ] },
      { heading: 'الثقة والتغطية', paras: ['يحمل كل حكم مستوى ثقة يعكس مقدار تغطية الإشارات المتاحة. ويُوسَم الحكم الجزئي (فئات لم تُقيَّم بعد) بذلك — لا يدّعي TrustSeal يقينًا أكثر مما تدعمه الأدلة.'] },
      { heading: 'الوصول البرمجي', paras: ['المنهجية قابلة للاستعلام: واجهة الثقة العامة (GET /api/trust/{domain}) تُعيد الحالة ومستوى الثقة والدرجة والثقة والتفصيل الكامل والإشارات بصيغة JSON. راجع التوثيق.'] },
    ],
  },
}
