// lib/trustseal/content/about.ts  (asq-trustseal-harden)
// Fully-localized About page content (replaces the placeholder page).
import type { LocalizedPage } from './types'

export const aboutContent: LocalizedPage = {
  en: {
    title: 'About TrustSeal',
    subtitle: 'Verifiable business trust for an internet where anyone can claim to be anyone.',
    sections: [
      { heading: 'What is TrustSeal', paras: ['TrustSeal turns domain ownership and reputation signals into a verifiable trust score, an embeddable badge, and a public seal page — so customers, partners, and platforms can trust who they deal with.'] },
      { heading: 'Why TrustSeal exists', paras: ['Online, anyone can claim to be anyone. Logos and "trust us" copy are trivial to fake. TrustSeal replaces self-asserted trust with verifiable, tamper-resistant signals anchored to domain ownership.'] },
      { heading: 'Business verification vision', paras: ['We want verifying a business to be as simple and universal as adding one DNS record — and the resulting signal to be recognized everywhere a business is evaluated.'] },
      { heading: 'Trust intelligence mission', paras: ['Beyond a binary checkmark, TrustSeal computes an explainable trust score and band from ownership, TLS, reputation, and risk signals — turning trust into measurable, comparable intelligence.'] },
      { heading: 'Relationship to A Square Solutions', paras: ['TrustSeal is a standalone product built and operated by A Square Solutions, an independent studio shipping production AI systems, SEO engineering, and trust infrastructure.'] },
      { heading: 'TrustSeal roadmap', bullets: ['Signed, verifiable badge attestations.', 'Continuous re-verification and monitoring.', 'A public verification API.', 'Deeper trust-intelligence analytics.'] },
      { heading: 'Global trust network vision', paras: ['Our long-term goal is a global trust network: a connected topology of verified domains, signals, and reputation that any platform can query to make safer decisions.'] },
      { heading: 'Built by A Square Solutions', paras: ['TrustSeal is built by A Square Solutions. © 2026 A Square Solutions. All rights reserved.'] },
    ],
  },
  hi: {
    title: 'TrustSeal के बारे में',
    subtitle: 'ऐसे इंटरनेट के लिए सत्यापन-योग्य व्यावसायिक भरोसा जहाँ कोई भी किसी का भी होने का दावा कर सकता है।',
    sections: [
      { heading: 'TrustSeal क्या है', paras: ['TrustSeal डोमेन स्वामित्व और प्रतिष्ठा संकेतों को एक सत्यापन-योग्य ट्रस्ट स्कोर, एम्बेड बैज और सार्वजनिक सील पेज में बदल देता है — ताकि ग्राहक, साझेदार और प्लेटफ़ॉर्म जान सकें कि वे किस पर भरोसा कर रहे हैं।'] },
      { heading: 'TrustSeal क्यों मौजूद है', paras: ['ऑनलाइन कोई भी किसी का भी होने का दावा कर सकता है। लोगो और "हम पर भरोसा करें" जैसी बातें नकली बनाना आसान है। TrustSeal स्व-घोषित भरोसे को डोमेन स्वामित्व पर आधारित सत्यापन-योग्य, छेड़छाड़-रोधी संकेतों से बदल देता है।'] },
      { heading: 'व्यवसाय सत्यापन की दृष्टि', paras: ['हम चाहते हैं कि किसी व्यवसाय का सत्यापन एक DNS रिकॉर्ड जोड़ने जितना सरल और सार्वभौमिक हो — और परिणामी संकेत हर जगह पहचाना जाए जहाँ व्यवसाय का मूल्यांकन होता है।'] },
      { heading: 'ट्रस्ट इंटेलिजेंस मिशन', paras: ['एक द्विआधारी चेकमार्क से आगे, TrustSeal स्वामित्व, TLS, प्रतिष्ठा और जोखिम संकेतों से एक स्पष्ट ट्रस्ट स्कोर और बैंड की गणना करता है — भरोसे को मापने-योग्य, तुलनीय इंटेलिजेंस में बदलता है।'] },
      { heading: 'A Square Solutions से संबंध', paras: ['TrustSeal एक स्वतंत्र उत्पाद है जिसे A Square Solutions बनाता और संचालित करता है — एक स्वतंत्र स्टूडियो जो प्रोडक्शन AI सिस्टम, SEO इंजीनियरिंग और ट्रस्ट अवसंरचना बनाता है।'] },
      { heading: 'TrustSeal रोडमैप', bullets: ['हस्ताक्षरित, सत्यापन-योग्य बैज सत्यापन।', 'निरंतर पुनः-सत्यापन और निगरानी।', 'एक सार्वजनिक सत्यापन API।', 'गहन ट्रस्ट-इंटेलिजेंस एनालिटिक्स।'] },
      { heading: 'वैश्विक ट्रस्ट नेटवर्क दृष्टि', paras: ['हमारा दीर्घकालिक लक्ष्य एक वैश्विक ट्रस्ट नेटवर्क है: सत्यापित डोमेन, संकेतों और प्रतिष्ठा की जुड़ी टोपोलॉजी जिसे कोई भी प्लेटफ़ॉर्म सुरक्षित निर्णयों के लिए क्वेरी कर सके।'] },
      { heading: 'A Square Solutions द्वारा निर्मित', paras: ['TrustSeal को A Square Solutions ने बनाया है। © 2026 A Square Solutions. सर्वाधिकार सुरक्षित।'] },
    ],
  },
  es: {
    title: 'Acerca de TrustSeal',
    subtitle: 'Confianza empresarial verificable para una internet donde cualquiera puede decir ser quien sea.',
    sections: [
      { heading: 'Qué es TrustSeal', paras: ['TrustSeal convierte la propiedad del dominio y las señales de reputación en un puntaje de confianza verificable, una insignia integrable y una página de sello pública — para que clientes, socios y plataformas confíen en con quién tratan.'] },
      { heading: 'Por qué existe TrustSeal', paras: ['En internet, cualquiera puede decir ser quien sea. Los logos y los textos de "confía en nosotros" son fáciles de falsificar. TrustSeal reemplaza la confianza autoproclamada por señales verificables y resistentes a manipulaciones ancladas en la propiedad del dominio.'] },
      { heading: 'Visión de verificación de empresas', paras: ['Queremos que verificar una empresa sea tan simple y universal como añadir un registro DNS — y que la señal resultante se reconozca en todo lugar donde se evalúe a una empresa.'] },
      { heading: 'Misión de inteligencia de confianza', paras: ['Más allá de una marca binaria, TrustSeal calcula un puntaje y una banda de confianza explicables a partir de propiedad, TLS, reputación y señales de riesgo — convirtiendo la confianza en inteligencia medible y comparable.'] },
      { heading: 'Relación con A Square Solutions', paras: ['TrustSeal es un producto independiente creado y operado por A Square Solutions, un estudio independiente que desarrolla sistemas de IA en producción, ingeniería SEO e infraestructura de confianza.'] },
      { heading: 'Hoja de ruta de TrustSeal', bullets: ['Atestaciones de insignia firmadas y verificables.', 'Reverificación y monitoreo continuos.', 'Una API pública de verificación.', 'Analíticas de inteligencia de confianza más profundas.'] },
      { heading: 'Visión de red de confianza global', paras: ['Nuestro objetivo a largo plazo es una red de confianza global: una topología conectada de dominios verificados, señales y reputación que cualquier plataforma pueda consultar para tomar decisiones más seguras.'] },
      { heading: 'Creado por A Square Solutions', paras: ['TrustSeal está desarrollado por A Square Solutions. © 2026 A Square Solutions. Todos los derechos reservados.'] },
    ],
  },
  ar: {
    title: 'حول TrustSeal',
    subtitle: 'ثقة أعمال قابلة للتحقق لإنترنت يستطيع فيه أي شخص ادّعاء أي هوية.',
    sections: [
      { heading: 'ما هو TrustSeal', paras: ['يحوّل TrustSeal ملكية النطاق وإشارات السمعة إلى درجة ثقة قابلة للتحقق وشارة قابلة للتضمين وصفحة ختم عامة — حتى يثق العملاء والشركاء والمنصات بمن يتعاملون معه.'] },
      { heading: 'لماذا وُجد TrustSeal', paras: ['على الإنترنت يستطيع أي شخص ادّعاء أي هوية، وتزوير الشعارات وعبارات "ثق بنا" سهل. يستبدل TrustSeal الثقة المُدّعاة بإشارات قابلة للتحقق ومقاومة للعبث مرتكزة على ملكية النطاق.'] },
      { heading: 'رؤية التحقق من الأعمال', paras: ['نريد أن يصبح التحقق من شركة بسيطًا وعالميًا كإضافة سجل DNS واحد — وأن تُعترف الإشارة الناتجة في كل مكان يُقيَّم فيه أي عمل.'] },
      { heading: 'مهمة ذكاء الثقة', paras: ['أبعد من علامة ثنائية، يحسب TrustSeal درجة ونطاق ثقة قابلين للتفسير من الملكية وTLS والسمعة وإشارات المخاطر — محوّلًا الثقة إلى ذكاء قابل للقياس والمقارنة.'] },
      { heading: 'العلاقة بـ A Square Solutions', paras: ['TrustSeal منتج مستقل تبنيه وتشغّله A Square Solutions، وهو استوديو مستقل يطوّر أنظمة ذكاء اصطناعي إنتاجية وهندسة SEO وبنية ثقة.'] },
      { heading: 'خارطة طريق TrustSeal', bullets: ['شهادات شارة موقّعة وقابلة للتحقق.', 'إعادة تحقق ومراقبة مستمرة.', 'واجهة برمجية عامة للتحقق.', 'تحليلات ذكاء ثقة أعمق.'] },
      { heading: 'رؤية شبكة الثقة العالمية', paras: ['هدفنا بعيد المدى شبكة ثقة عالمية: بنية مترابطة من النطاقات الموثّقة والإشارات والسمعة يمكن لأي منصة الاستعلام عنها لاتخاذ قرارات أكثر أمانًا.'] },
      { heading: 'من تطوير A Square Solutions', paras: ['TrustSeal من تطوير A Square Solutions. © 2026 A Square Solutions. جميع الحقوق محفوظة.'] },
    ],
  },
}
