// lib/trustseal/content/customers.ts  (asq-trustseal-conversion)
// Localized copy for the Customers page. The live verified-domain list is the real
// social proof (fetched server-side); use cases are static; the testimonials block
// is an honest framework (no fabricated quotes) that invites real stories.
import type { Locale } from '../locales'

interface UseCase { title: string; body: string }
interface CustomersCopy {
  title: string; subtitle: string
  verifiedHeading: string; verifiedEmpty: string; verifiedCta: string
  useCasesHeading: string; useCases: UseCase[]
  testimonialsHeading: string; testimonialsBody: string; testimonialsCta: string
}

export const customersContent: Record<Locale, CustomersCopy> = {
  en: {
    title: 'Customers', subtitle: 'Businesses that have proven who they are with TrustSeal.',
    verifiedHeading: 'Verified on TrustSeal', verifiedEmpty: 'Be the first verified business — it takes one DNS record.', verifiedCta: 'View public seal',
    useCasesHeading: 'How businesses use TrustSeal', useCases: [
      { title: 'Marketplaces & platforms', body: 'Verify seller and partner domains at onboarding and show a trust level before transactions.' },
      { title: 'E-commerce & checkout', body: 'Display a live trust badge so shoppers know the store is a verified, real business.' },
      { title: 'B2B & procurement', body: 'Confirm a vendor controls its domain and carries a clean trust score before you sign.' },
      { title: 'Agencies', body: 'Verify and monitor every client domain from one dashboard, co-branded.' },
    ],
    testimonialsHeading: 'Customer stories', testimonialsBody: 'We’re collecting stories from early TrustSeal customers. If TrustSeal helped your business prove its trustworthiness, we’d love to feature you.', testimonialsCta: 'Share your story',
  },
  hi: {
    title: 'ग्राहक', subtitle: 'ऐसे व्यवसाय जिन्होंने TrustSeal से यह सिद्ध किया कि वे कौन हैं।',
    verifiedHeading: 'TrustSeal पर सत्यापित', verifiedEmpty: 'पहले सत्यापित व्यवसाय बनें — बस एक DNS रिकॉर्ड चाहिए।', verifiedCta: 'सार्वजनिक सील देखें',
    useCasesHeading: 'व्यवसाय TrustSeal का उपयोग कैसे करते हैं', useCases: [
      { title: 'मार्केटप्लेस और प्लेटफ़ॉर्म', body: 'ऑनबोर्डिंग पर विक्रेता और साझेदार डोमेन सत्यापित करें और लेन-देन से पहले ट्रस्ट स्तर दिखाएं।' },
      { title: 'ई-कॉमर्स और चेकआउट', body: 'लाइव ट्रस्ट बैज दिखाएं ताकि ग्राहक जानें कि स्टोर एक सत्यापित, वास्तविक व्यवसाय है।' },
      { title: 'B2B और खरीद', body: 'हस्ताक्षर से पहले पुष्टि करें कि विक्रेता अपने डोमेन को नियंत्रित करता है और उसका ट्रस्ट स्कोर साफ़ है।' },
      { title: 'एजेंसियां', body: 'एक ही डैशबोर्ड से हर क्लाइंट डोमेन को सत्यापित और निगरानी करें, को-ब्रांडेड।' },
    ],
    testimonialsHeading: 'ग्राहक कहानियां', testimonialsBody: 'हम शुरुआती TrustSeal ग्राहकों से कहानियां एकत्र कर रहे हैं। यदि TrustSeal ने आपके व्यवसाय की विश्वसनीयता सिद्ध करने में मदद की, तो हम आपको प्रस्तुत करना चाहेंगे।', testimonialsCta: 'अपनी कहानी साझा करें',
  },
  es: {
    title: 'Clientes', subtitle: 'Empresas que han demostrado quiénes son con TrustSeal.',
    verifiedHeading: 'Verificadas en TrustSeal', verifiedEmpty: 'Sé la primera empresa verificada — basta un registro DNS.', verifiedCta: 'Ver sello público',
    useCasesHeading: 'Cómo las empresas usan TrustSeal', useCases: [
      { title: 'Marketplaces y plataformas', body: 'Verifica dominios de vendedores y socios en el onboarding y muestra un nivel de confianza antes de operar.' },
      { title: 'E-commerce y checkout', body: 'Muestra una insignia de confianza en vivo para que los compradores sepan que la tienda es real y verificada.' },
      { title: 'B2B y compras', body: 'Confirma que un proveedor controla su dominio y tiene un puntaje de confianza limpio antes de firmar.' },
      { title: 'Agencias', body: 'Verifica y monitorea cada dominio de cliente desde un panel, con tu marca.' },
    ],
    testimonialsHeading: 'Historias de clientes', testimonialsBody: 'Estamos recopilando historias de los primeros clientes de TrustSeal. Si TrustSeal ayudó a tu empresa a demostrar su confiabilidad, nos encantaría destacarte.', testimonialsCta: 'Comparte tu historia',
  },
  ar: {
    title: 'العملاء', subtitle: 'شركات أثبتت هويتها عبر TrustSeal.',
    verifiedHeading: 'موثّقة على TrustSeal', verifiedEmpty: 'كن أول نشاط موثّق — يكفي سجل DNS واحد.', verifiedCta: 'عرض الختم العام',
    useCasesHeading: 'كيف تستخدم الشركات TrustSeal', useCases: [
      { title: 'الأسواق والمنصات', body: 'وثّق نطاقات البائعين والشركاء عند الانضمام واعرض مستوى الثقة قبل المعاملات.' },
      { title: 'التجارة الإلكترونية والدفع', body: 'اعرض شارة ثقة حيّة ليعرف المتسوقون أن المتجر نشاط حقيقي موثّق.' },
      { title: 'B2B والمشتريات', body: 'تأكّد من أن المورّد يتحكم في نطاقه ويحمل درجة ثقة نظيفة قبل التوقيع.' },
      { title: 'الوكالات', body: 'وثّق وراقب كل نطاق عميل من لوحة واحدة بعلامتك.' },
    ],
    testimonialsHeading: 'قصص العملاء', testimonialsBody: 'نجمع قصصًا من أوائل عملاء TrustSeal. إذا ساعد TrustSeal نشاطك في إثبات مصداقيته، يسعدنا إبرازك.', testimonialsCta: 'شارك قصتك',
  },
}
