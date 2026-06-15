// lib/trustseal/content/security.ts  (asq-trustseal-harden)
// Fully-localized Security Center content (replaces the placeholder page).
import type { LocalizedPage } from './types'

export const securityContent: LocalizedPage = {
  en: {
    title: 'Security Center',
    subtitle: 'How TrustSeal protects verification integrity, your data, and the trust signal customers rely on.',
    sections: [
      { heading: 'Security overview', paras: ['Security is foundational to TrustSeal: a trust signal is only valuable if it cannot be faked. We design every layer — verification, badges, billing — to be tamper-resistant and server-authoritative.'] },
      { heading: 'Infrastructure security', bullets: ['Served over HTTPS on a managed edge platform with automatic TLS.', 'Authentication via Firebase; account data is access-scoped per user.', 'Secrets are held server-side and never exposed to the browser.'] },
      { heading: 'DNS verification security', paras: ['Domain ownership is proven with a unique, per-claim DNS TXT token. The first account to verify a domain owns it within TrustSeal. Tokens expire, and verification is re-checked over time.'] },
      { heading: 'Trust badge integrity', bullets: ['The embeddable badge checks LIVE status on every load — a copied or static badge cannot fake "verified".', 'The badge is origin-bound to the claimed domain; an unverified origin renders a warning, not a checkmark.', 'If verification expires or is revoked, the badge degrades within the cache TTL.'] },
      { heading: 'Fraud prevention', paras: ['Verified, expired, and revoked states are computed server-side. Displaying a verified badge for a domain that is not actually verified is a fraudulent verification claim and is prohibited and enforced.'] },
      { heading: 'Abuse detection', paras: ['We monitor for impersonation, badge misuse, and abnormal verification activity, and act on reports of fraudulent verification claims.'] },
      { heading: 'Responsible disclosure', paras: ['We support coordinated disclosure. Report issues privately and allow a reasonable remediation window before any public disclosure. We will not pursue good-faith research conducted within our policy.'] },
      { heading: 'Vulnerability reporting', bullets: ['Email contact@asquaresolution.com with subject "SECURITY — TrustSeal".', 'Include description, reproduction steps, affected endpoint, and impact.', 'See the full policy at /legal/security.'] },
      { heading: 'Security roadmap', bullets: ['Signed, verifiable badge attestations.', 'Continuous re-verification and drift alerts.', 'A published bug-bounty program.'] },
      { heading: 'Security contact', paras: ['For all security matters: contact@asquaresolution.com.'] },
    ],
  },
  hi: {
    title: 'सुरक्षा केंद्र',
    subtitle: 'TrustSeal सत्यापन की अखंडता, आपके डेटा और ग्राहकों के भरोसे के संकेत की रक्षा कैसे करता है।',
    sections: [
      { heading: 'सुरक्षा अवलोकन', paras: ['सुरक्षा TrustSeal की नींव है: कोई ट्रस्ट संकेत तभी मूल्यवान है जब उसे नकली न बनाया जा सके। हम हर परत — सत्यापन, बैज, बिलिंग — को छेड़छाड़-रोधी और सर्वर-आधिकारिक बनाते हैं।'] },
      { heading: 'अवसंरचना सुरक्षा', bullets: ['स्वचालित TLS के साथ प्रबंधित एज प्लेटफ़ॉर्म पर HTTPS के ज़रिए सर्व किया जाता है।', 'Firebase के माध्यम से प्रमाणीकरण; खाता डेटा प्रति उपयोगकर्ता सीमित होता है।', 'सीक्रेट सर्वर-साइड रहते हैं और ब्राउज़र को कभी नहीं दिखाए जाते।'] },
      { heading: 'DNS सत्यापन सुरक्षा', paras: ['डोमेन स्वामित्व एक अद्वितीय, प्रति-दावा DNS TXT टोकन से सिद्ध होता है। सबसे पहले सत्यापित करने वाला खाता ही मालिक होता है। टोकन समाप्त होते हैं और सत्यापन समय-समय पर पुनः जाँचा जाता है।'] },
      { heading: 'ट्रस्ट बैज अखंडता', bullets: ['एम्बेड बैज हर लोड पर लाइव स्थिति जाँचता है — कॉपी किया गया बैज "सत्यापित" का दिखावा नहीं कर सकता।', 'बैज दावा किए गए डोमेन से बंधा होता है; असत्यापित मूल पर चेतावनी दिखती है।', 'सत्यापन समाप्त/रद्द होने पर बैज कैश TTL के भीतर डाउनग्रेड हो जाता है।'] },
      { heading: 'धोखाधड़ी रोकथाम', paras: ['सत्यापित, समाप्त और रद्द स्थितियाँ सर्वर-साइड गणना होती हैं। असत्यापित डोमेन के लिए सत्यापित बैज दिखाना एक धोखाधड़ीपूर्ण सत्यापन दावा है और निषिद्ध है।'] },
      { heading: 'दुरुपयोग का पता लगाना', paras: ['हम प्रतिरूपण, बैज दुरुपयोग और असामान्य सत्यापन गतिविधि की निगरानी करते हैं और धोखाधड़ीपूर्ण दावों की रिपोर्ट पर कार्रवाई करते हैं।'] },
      { heading: 'जिम्मेदार प्रकटीकरण', paras: ['हम समन्वित प्रकटीकरण का समर्थन करते हैं। समस्याओं की निजी रिपोर्ट करें और सार्वजनिक प्रकटीकरण से पहले उचित समय दें।'] },
      { heading: 'भेद्यता रिपोर्टिंग', bullets: ['विषय "SECURITY — TrustSeal" के साथ contact@asquaresolution.com पर ईमेल करें।', 'विवरण, चरण, प्रभावित एंडपॉइंट और प्रभाव शामिल करें।', 'पूरी नीति /legal/security पर देखें।'] },
      { heading: 'सुरक्षा रोडमैप', bullets: ['हस्ताक्षरित, सत्यापन-योग्य बैज सत्यापन।', 'निरंतर पुनः-सत्यापन और ड्रिफ्ट अलर्ट।', 'प्रकाशित बग-बाउंटी कार्यक्रम।'] },
      { heading: 'सुरक्षा संपर्क', paras: ['सभी सुरक्षा मामलों के लिए: contact@asquaresolution.com।'] },
    ],
  },
  es: {
    title: 'Centro de seguridad',
    subtitle: 'Cómo TrustSeal protege la integridad de la verificación, tus datos y la señal de confianza en la que confían los clientes.',
    sections: [
      { heading: 'Visión general de seguridad', paras: ['La seguridad es la base de TrustSeal: una señal de confianza solo vale si no se puede falsificar. Diseñamos cada capa — verificación, insignias, facturación — para que sea resistente a manipulaciones y con autoridad en el servidor.'] },
      { heading: 'Seguridad de la infraestructura', bullets: ['Se sirve por HTTPS en una plataforma edge gestionada con TLS automático.', 'Autenticación mediante Firebase; los datos de cuenta están limitados por usuario.', 'Los secretos se guardan en el servidor y nunca se exponen al navegador.'] },
      { heading: 'Seguridad de la verificación DNS', paras: ['La propiedad del dominio se prueba con un token DNS TXT único por reclamación. La primera cuenta que verifica es la propietaria. Los tokens caducan y la verificación se vuelve a comprobar con el tiempo.'] },
      { heading: 'Integridad de la insignia', bullets: ['La insignia comprueba el estado EN VIVO en cada carga — una copia estática no puede fingir "verificado".', 'La insignia está vinculada al dominio reclamado; un origen no verificado muestra una advertencia.', 'Si la verificación caduca o se revoca, la insignia se degrada dentro del TTL de caché.'] },
      { heading: 'Prevención del fraude', paras: ['Los estados verificado, caducado y revocado se calculan en el servidor. Mostrar una insignia verificada para un dominio no verificado es una declaración de verificación fraudulenta y está prohibido.'] },
      { heading: 'Detección de abuso', paras: ['Supervisamos la suplantación, el uso indebido de insignias y la actividad de verificación anómala, y actuamos ante denuncias de declaraciones fraudulentas.'] },
      { heading: 'Divulgación responsable', paras: ['Apoyamos la divulgación coordinada. Informa los problemas de forma privada y concede un plazo razonable de corrección antes de cualquier divulgación pública.'] },
      { heading: 'Informe de vulnerabilidades', bullets: ['Escribe a contact@asquaresolution.com con el asunto "SECURITY — TrustSeal".', 'Incluye descripción, pasos, endpoint afectado e impacto.', 'Consulta la política completa en /legal/security.'] },
      { heading: 'Hoja de ruta de seguridad', bullets: ['Atestaciones de insignia firmadas y verificables.', 'Reverificación continua y alertas de desviación.', 'Un programa público de recompensas por errores.'] },
      { heading: 'Contacto de seguridad', paras: ['Para todo asunto de seguridad: contact@asquaresolution.com.'] },
    ],
  },
  ar: {
    title: 'مركز الأمان',
    subtitle: 'كيف يحمي TrustSeal سلامة التحقق وبياناتك وإشارة الثقة التي يعتمد عليها العملاء.',
    sections: [
      { heading: 'نظرة عامة على الأمان', paras: ['الأمان أساس TrustSeal: إشارة الثقة لا قيمة لها إن أمكن تزويرها. نصمّم كل طبقة — التحقق والشارات والفوترة — لتكون مقاومة للعبث وذات سلطة على الخادم.'] },
      { heading: 'أمان البنية التحتية', bullets: ['يُقدَّم عبر HTTPS على منصة حافة مُدارة مع TLS تلقائي.', 'المصادقة عبر Firebase؛ بيانات الحساب مقيّدة لكل مستخدم.', 'تبقى الأسرار على الخادم ولا تُكشف للمتصفح أبدًا.'] },
      { heading: 'أمان التحقق عبر DNS', paras: ['تُثبَت ملكية النطاق برمز DNS TXT فريد لكل مطالبة. أول حساب يتحقق يملك النطاق. تنتهي صلاحية الرموز ويُعاد فحص التحقق مع الوقت.'] },
      { heading: 'سلامة شارة الثقة', bullets: ['تتحقق الشارة المضمّنة من الحالة الحيّة عند كل تحميل — لا يمكن لنسخة ثابتة تزييف "مُوثّق".', 'الشارة مرتبطة بالنطاق المُطالَب به؛ المصدر غير الموثّق يُظهر تحذيرًا.', 'عند انتهاء التحقق أو إلغائه تتراجع الشارة خلال مدة التخزين المؤقت.'] },
      { heading: 'منع الاحتيال', paras: ['تُحسب حالات مُوثّق ومنتهٍ ومُلغى على الخادم. عرض شارة موثّقة لنطاق غير موثّق هو ادعاء تحقق احتيالي ومحظور.'] },
      { heading: 'كشف إساءة الاستخدام', paras: ['نراقب انتحال الهوية وإساءة استخدام الشارات ونشاط التحقق غير المعتاد، ونتصرف بناءً على بلاغات الادعاءات الاحتيالية.'] },
      { heading: 'الإفصاح المسؤول', paras: ['ندعم الإفصاح المنسّق. أبلغ عن المشكلات بشكل خاص وامنح مهلة معقولة للإصلاح قبل أي إفصاح علني.'] },
      { heading: 'الإبلاغ عن الثغرات', bullets: ['راسل contact@asquaresolution.com بعنوان "SECURITY — TrustSeal".', 'أرفق الوصف والخطوات ونقطة النهاية المتأثرة والأثر.', 'اطّلع على السياسة الكاملة في /legal/security.'] },
      { heading: 'خارطة طريق الأمان', bullets: ['شهادات شارة موقّعة وقابلة للتحقق.', 'إعادة تحقق مستمرة وتنبيهات الانحراف.', 'برنامج مكافآت أخطاء منشور.'] },
      { heading: 'جهة اتصال الأمان', paras: ['لكل أمور الأمان: contact@asquaresolution.com.'] },
    ],
  },
}
