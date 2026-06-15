// lib/trustseal/content/docs.ts  (asq-trustseal-harden)
// Fully-localized Documentation Center content (replaces the placeholder page).
import type { LocalizedPage } from './types'

export const docsContent: LocalizedPage = {
  en: {
    title: 'Documentation',
    subtitle: 'Everything you need to verify a domain, publish your trust badge, and understand the trust score.',
    sections: [
      { heading: 'Getting started', bullets: ['Sign in and open your dashboard.', 'Enter the domain you want to verify.', 'Add the DNS TXT record we generate, then click Verify.', 'Publish your badge and share your public seal page.'] },
      { heading: 'How verification works', paras: ['TrustSeal confirms that you control a domain, then turns ownership and reputation signals into a single, explainable trust score. The first account to verify a domain owns it within TrustSeal.'] },
      { heading: 'DNS TXT verification', paras: ['We issue a unique TXT record for your claim. Add it at your DNS provider on the host we show (apex or the _trustseal fallback). When detected, ownership is confirmed. DNS can take a few minutes to propagate.'] },
      { heading: 'Trust score methodology', paras: ['The score combines ownership confirmation, TLS, reputation, and risk signals into a 0–100 value mapped to a trust band. It is explainable and updates as your standing changes.'] },
      { heading: 'Trust levels', bullets: ['Verified — ownership confirmed, signals strong.', 'Established — solid, consistent reputation history.', 'Limited — verified but thin or new signals.', 'Caution — anomalies detected; review before transacting.', 'Risk — blocklist or impersonation signals.'] },
      { heading: 'Verification lifecycle', paras: ['A claim moves pending → verified. Verification is periodically re-checked; if signals change or ownership lapses, the band and badge update accordingly.'] },
      { heading: 'Trust badge setup', paras: ['Add one script tag to your site: <script src="https://trustseal.asquaresolution.com/badge.js" data-domain="yourdomain.com"></script>. The badge checks live status and is origin-bound to your domain.'] },
      { heading: 'Billing', paras: ['Free includes one verified domain and a public seal page. Pro adds the embeddable badge, the Command Center, analytics, and multiple domains. Cancelling stops renewal; Pro access continues until the paid period ends.'] },
      { heading: 'FAQ', paras: ['Common questions are answered on the home page FAQ and throughout these docs. For anything else, contact contact@asquaresolution.com.'] },
      { heading: 'Command Center', paras: ['Pro unlocks the Trust Intelligence Command Center — a live operational view of your domains, signals, and verification activity.'] },
      { heading: 'API roadmap', paras: ['A public API for programmatic verification, status, and badge management is on the roadmap. Express interest at contact@asquaresolution.com.'] },
    ],
  },
  hi: {
    title: 'दस्तावेज़ीकरण',
    subtitle: 'डोमेन सत्यापित करने, ट्रस्ट बैज प्रकाशित करने और ट्रस्ट स्कोर समझने के लिए आवश्यक सब कुछ।',
    sections: [
      { heading: 'शुरुआत करें', bullets: ['साइन इन करें और अपना डैशबोर्ड खोलें।', 'वह डोमेन दर्ज करें जिसे आप सत्यापित करना चाहते हैं।', 'हमारे द्वारा बनाया गया DNS TXT रिकॉर्ड जोड़ें, फिर सत्यापित करें पर क्लिक करें।', 'अपना बैज प्रकाशित करें और सार्वजनिक सील पेज साझा करें।'] },
      { heading: 'सत्यापन कैसे काम करता है', paras: ['TrustSeal पुष्टि करता है कि आप किसी डोमेन को नियंत्रित करते हैं, फिर स्वामित्व और प्रतिष्ठा संकेतों को एक स्पष्ट ट्रस्ट स्कोर में बदल देता है। सबसे पहले सत्यापित करने वाला खाता मालिक होता है।'] },
      { heading: 'DNS TXT सत्यापन', paras: ['हम आपके दावे के लिए एक अद्वितीय TXT रिकॉर्ड जारी करते हैं। इसे अपने DNS प्रदाता पर दिखाए गए होस्ट (एपेक्स या _trustseal फॉलबैक) पर जोड़ें। पता चलते ही स्वामित्व पुष्ट हो जाता है। DNS को फैलने में कुछ मिनट लग सकते हैं।'] },
      { heading: 'ट्रस्ट स्कोर पद्धति', paras: ['स्कोर स्वामित्व पुष्टि, TLS, प्रतिष्ठा और जोखिम संकेतों को 0–100 मान में जोड़ता है जो एक ट्रस्ट बैंड से मैप होता है। यह स्पष्ट है और आपकी स्थिति के साथ अपडेट होता है।'] },
      { heading: 'ट्रस्ट स्तर', bullets: ['सत्यापित — स्वामित्व पुष्ट, संकेत मजबूत।', 'स्थापित — ठोस, सुसंगत प्रतिष्ठा इतिहास।', 'सीमित — सत्यापित पर कम या नए संकेत।', 'सावधानी — विसंगतियाँ; लेन-देन से पहले समीक्षा करें।', 'जोखिम — ब्लॉकलिस्ट या प्रतिरूपण संकेत।'] },
      { heading: 'सत्यापन जीवनचक्र', paras: ['दावा लंबित → सत्यापित होता है। सत्यापन समय-समय पर पुनः जाँचा जाता है; संकेत बदलने या स्वामित्व समाप्त होने पर बैंड और बैज अपडेट होते हैं।'] },
      { heading: 'ट्रस्ट बैज सेटअप', paras: ['अपनी साइट पर एक स्क्रिप्ट टैग जोड़ें: <script src="https://trustseal.asquaresolution.com/badge.js" data-domain="yourdomain.com"></script>. बैज लाइव स्थिति जाँचता है और आपके डोमेन से बंधा होता है।'] },
      { heading: 'बिलिंग', paras: ['मुफ़्त में एक सत्यापित डोमेन और सार्वजनिक सील पेज मिलता है। Pro में एम्बेड बैज, कमांड सेंटर, एनालिटिक्स और कई डोमेन जुड़ते हैं। रद्द करने पर नवीनीकरण रुकता है; Pro पहुँच भुगतान अवधि तक बनी रहती है।'] },
      { heading: 'सामान्य प्रश्न', paras: ['सामान्य प्रश्न होम पेज के FAQ और इन दस्तावेज़ों में उत्तरित हैं। अन्य किसी बात के लिए contact@asquaresolution.com पर संपर्क करें।'] },
      { heading: 'कमांड सेंटर', paras: ['Pro ट्रस्ट इंटेलिजेंस कमांड सेंटर अनलॉक करता है — आपके डोमेन, संकेतों और सत्यापन गतिविधि का लाइव परिचालन दृश्य।'] },
      { heading: 'API रोडमैप', paras: ['प्रोग्रामेटिक सत्यापन, स्थिति और बैज प्रबंधन के लिए एक सार्वजनिक API रोडमैप पर है। contact@asquaresolution.com पर रुचि व्यक्त करें।'] },
    ],
  },
  es: {
    title: 'Documentación',
    subtitle: 'Todo lo necesario para verificar un dominio, publicar tu insignia de confianza y entender el puntaje de confianza.',
    sections: [
      { heading: 'Primeros pasos', bullets: ['Inicia sesión y abre tu panel.', 'Introduce el dominio que quieres verificar.', 'Añade el registro DNS TXT que generamos y haz clic en Verificar.', 'Publica tu insignia y comparte tu página de sello pública.'] },
      { heading: 'Cómo funciona la verificación', paras: ['TrustSeal confirma que controlas un dominio y convierte las señales de propiedad y reputación en un puntaje de confianza explicable. La primera cuenta que verifica es la propietaria.'] },
      { heading: 'Verificación DNS TXT', paras: ['Emitimos un registro TXT único para tu reclamación. Añádelo en tu proveedor de DNS en el host indicado (raíz o el respaldo _trustseal). Al detectarlo, se confirma la propiedad. El DNS puede tardar unos minutos en propagarse.'] },
      { heading: 'Metodología del puntaje', paras: ['El puntaje combina confirmación de propiedad, TLS, reputación y señales de riesgo en un valor 0–100 asignado a una banda de confianza. Es explicable y se actualiza con tu situación.'] },
      { heading: 'Niveles de confianza', bullets: ['Verificado — propiedad confirmada, señales fuertes.', 'Establecido — historial de reputación sólido y constante.', 'Limitado — verificado pero con señales escasas o nuevas.', 'Precaución — anomalías; revisa antes de operar.', 'Riesgo — señales de lista de bloqueo o suplantación.'] },
      { heading: 'Ciclo de vida de la verificación', paras: ['Una reclamación pasa de pendiente a verificada. La verificación se vuelve a comprobar periódicamente; si las señales cambian o caduca la propiedad, la banda y la insignia se actualizan.'] },
      { heading: 'Configuración de la insignia', paras: ['Añade una etiqueta a tu sitio: <script src="https://trustseal.asquaresolution.com/badge.js" data-domain="tudominio.com"></script>. La insignia comprueba el estado en vivo y está vinculada a tu dominio.'] },
      { heading: 'Facturación', paras: ['Gratis incluye un dominio verificado y una página de sello pública. Pro añade la insignia integrable, el Centro de Mando, analíticas y varios dominios. Cancelar detiene la renovación; el acceso Pro continúa hasta fin del periodo pagado.'] },
      { heading: 'Preguntas frecuentes', paras: ['Las preguntas comunes se responden en las FAQ de la página de inicio y en esta documentación. Para lo demás, escribe a contact@asquaresolution.com.'] },
      { heading: 'Centro de Mando', paras: ['Pro desbloquea el Centro de Mando de Inteligencia de Confianza — una vista operativa en vivo de tus dominios, señales y actividad de verificación.'] },
      { heading: 'Hoja de ruta de la API', paras: ['Una API pública para verificación, estado y gestión de insignias está en la hoja de ruta. Manifiesta tu interés en contact@asquaresolution.com.'] },
    ],
  },
  ar: {
    title: 'التوثيق',
    subtitle: 'كل ما تحتاجه لتوثيق نطاق ونشر شارة الثقة وفهم درجة الثقة.',
    sections: [
      { heading: 'البدء', bullets: ['سجّل الدخول وافتح لوحتك.', 'أدخل النطاق الذي تريد توثيقه.', 'أضف سجل DNS TXT الذي ننشئه، ثم انقر تحقّق.', 'انشر شارتك وشارك صفحة الختم العامة.'] },
      { heading: 'كيف يعمل التحقق', paras: ['يؤكّد TrustSeal أنك تتحكم في النطاق، ثم يحوّل إشارات الملكية والسمعة إلى درجة ثقة قابلة للتفسير. أول حساب يتحقق يملك النطاق.'] },
      { heading: 'التحقق عبر DNS TXT', paras: ['نُصدر سجل TXT فريدًا لمطالبتك. أضفه لدى مزوّد DNS على المضيف المعروض (الجذر أو بديل _trustseal). عند اكتشافه تتأكد الملكية. قد يستغرق انتشار DNS بضع دقائق.'] },
      { heading: 'منهجية درجة الثقة', paras: ['تجمع الدرجة بين تأكيد الملكية وTLS والسمعة وإشارات المخاطر في قيمة 0–100 تُربط بنطاق ثقة. وهي قابلة للتفسير وتتحدث مع وضعك.'] },
      { heading: 'مستويات الثقة', bullets: ['مُوثّق — الملكية مؤكدة والإشارات قوية.', 'راسخ — تاريخ سمعة متين ومتسق.', 'محدود — موثّق لكن بإشارات قليلة أو جديدة.', 'تحذير — شذوذ؛ راجع قبل التعامل.', 'خطر — إشارات قائمة حظر أو انتحال.'] },
      { heading: 'دورة حياة التحقق', paras: ['تنتقل المطالبة من معلّقة إلى موثّقة. يُعاد فحص التحقق دوريًا؛ وعند تغيّر الإشارات أو انقضاء الملكية يتحدّث النطاق والشارة.'] },
      { heading: 'إعداد شارة الثقة', paras: ['أضف وسم سكربت واحد إلى موقعك: <script src="https://trustseal.asquaresolution.com/badge.js" data-domain="yourdomain.com"></script>. تتحقق الشارة من الحالة الحيّة وترتبط بنطاقك.'] },
      { heading: 'الفوترة', paras: ['المجاني يشمل نطاقًا موثّقًا واحدًا وصفحة ختم عامة. يضيف Pro الشارة القابلة للتضمين ومركز القيادة والتحليلات ونطاقات متعددة. الإلغاء يوقف التجديد؛ ويبقى وصول Pro حتى نهاية المدة المدفوعة.'] },
      { heading: 'الأسئلة الشائعة', paras: ['تُجاب الأسئلة الشائعة في قسم الأسئلة بالصفحة الرئيسية وفي هذه الوثائق. لأي أمر آخر راسل contact@asquaresolution.com.'] },
      { heading: 'مركز القيادة', paras: ['يفتح Pro مركز قيادة ذكاء الثقة — عرض تشغيلي حيّ لنطاقاتك وإشاراتك ونشاط التحقق.'] },
      { heading: 'خارطة طريق الواجهة البرمجية', paras: ['واجهة برمجية عامة للتحقق والحالة وإدارة الشارات مدرجة في خارطة الطريق. عبّر عن اهتمامك عبر contact@asquaresolution.com.'] },
    ],
  },
}
