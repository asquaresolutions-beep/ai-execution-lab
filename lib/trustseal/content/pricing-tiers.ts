// lib/trustseal/content/pricing-tiers.ts  (asq-trustseal-growth)
// Localized copy for the Business / Enterprise / Agency tiers + the expanded
// comparison rows (Monitoring, API). Co-located (not in the shared message dicts)
// so the growth pass adds tiers without editing completed localization. Free/Pro
// continue to come from the existing `pricing`/`pricingPage` namespaces.
import type { Locale } from '../locales'

export const PRICING_CONTACT = 'contact@asquaresolution.com'

interface Tier { name: string; price: string; tagline: string; features: string[]; cta: string }
interface PricingTiers {
  business: Tier
  enterprise: Tier
  agency: Tier
  compareHeads: { business: string; enterprise: string }
  rows: { monitoring: string; api: string; certificates: string }
  selfServeNote: string
}

export const pricingTiers: Record<Locale, PricingTiers> = {
  en: {
    business: { name: 'Business', price: '₹1,999/mo', tagline: 'For teams that need monitoring', features: ['Up to 10 domains', 'Continuous monitoring + alerts', 'Higher API quota (3k/min)', 'Verification certificates', 'Trust history & email alerts'], cta: 'Contact sales' },
    enterprise: { name: 'Enterprise', price: 'Contact sales', tagline: 'For organizations at scale', features: ['Unlimited domains', 'Organizations, teams & roles', 'White-label trust badges', 'Custom seal URLs', 'SSO & SLA'], cta: 'Contact sales' },
    agency: { name: 'Agency', price: 'Contact sales', tagline: 'For agencies & resellers', features: ['Client management dashboard', 'Bulk verification', 'Agency co-branding', 'Reseller billing'], cta: 'Contact sales' },
    compareHeads: { business: 'Business', enterprise: 'Enterprise' },
    rows: { monitoring: 'Monitoring & alerts', api: 'Public API quota', certificates: 'Verification certificates' },
    selfServeNote: 'Business self-serve checkout is rolling out — contact sales to get started today.',
  },
  hi: {
    business: { name: 'बिज़नेस', price: '₹1,999/माह', tagline: 'निगरानी चाहने वाली टीमों के लिए', features: ['10 डोमेन तक', 'निरंतर निगरानी + अलर्ट', 'उच्च API कोटा (3k/मिनट)', 'सत्यापन प्रमाणपत्र', 'ट्रस्ट इतिहास और ईमेल अलर्ट'], cta: 'सेल्स से संपर्क करें' },
    enterprise: { name: 'एंटरप्राइज़', price: 'सेल्स से संपर्क करें', tagline: 'बड़े संगठनों के लिए', features: ['असीमित डोमेन', 'संगठन, टीम और भूमिकाएं', 'व्हाइट-लेबल ट्रस्ट बैज', 'कस्टम सील URL', 'SSO और SLA'], cta: 'सेल्स से संपर्क करें' },
    agency: { name: 'एजेंसी', price: 'सेल्स से संपर्क करें', tagline: 'एजेंसियों और रीसेलर के लिए', features: ['क्लाइंट प्रबंधन डैशबोर्ड', 'बल्क सत्यापन', 'एजेंसी को-ब्रांडिंग', 'रीसेलर बिलिंग'], cta: 'सेल्स से संपर्क करें' },
    compareHeads: { business: 'बिज़नेस', enterprise: 'एंटरप्राइज़' },
    rows: { monitoring: 'निगरानी और अलर्ट', api: 'सार्वजनिक API कोटा', certificates: 'सत्यापन प्रमाणपत्र' },
    selfServeNote: 'बिज़नेस सेल्फ-सर्व चेकआउट जल्द आ रहा है — आज ही शुरू करने के लिए सेल्स से संपर्क करें।',
  },
  es: {
    business: { name: 'Business', price: '₹1,999/mes', tagline: 'Para equipos que necesitan monitoreo', features: ['Hasta 10 dominios', 'Monitoreo continuo + alertas', 'Mayor cuota de API (3k/min)', 'Certificados de verificación', 'Historial de confianza y alertas por correo'], cta: 'Contactar a ventas' },
    enterprise: { name: 'Enterprise', price: 'Contactar a ventas', tagline: 'Para organizaciones a escala', features: ['Dominios ilimitados', 'Organizaciones, equipos y roles', 'Insignias de marca blanca', 'URLs de sello personalizadas', 'SSO y SLA'], cta: 'Contactar a ventas' },
    agency: { name: 'Agency', price: 'Contactar a ventas', tagline: 'Para agencias y revendedores', features: ['Panel de gestión de clientes', 'Verificación masiva', 'Co-marca de agencia', 'Facturación de reventa'], cta: 'Contactar a ventas' },
    compareHeads: { business: 'Business', enterprise: 'Enterprise' },
    rows: { monitoring: 'Monitoreo y alertas', api: 'Cuota de API pública', certificates: 'Certificados de verificación' },
    selfServeNote: 'El pago de autoservicio de Business está en despliegue — contacta a ventas para empezar hoy.',
  },
  ar: {
    business: { name: 'Business', price: '₹1,999/شهر', tagline: 'للفرق التي تحتاج إلى مراقبة', features: ['حتى 10 نطاقات', 'مراقبة مستمرة + تنبيهات', 'حصة API أعلى (3k/دقيقة)', 'شهادات التحقق', 'سجل الثقة وتنبيهات البريد'], cta: 'تواصل مع المبيعات' },
    enterprise: { name: 'Enterprise', price: 'تواصل مع المبيعات', tagline: 'للمؤسسات على نطاق واسع', features: ['نطاقات غير محدودة', 'مؤسسات وفرق وأدوار', 'شارات بعلامة بيضاء', 'روابط ختم مخصصة', 'SSO وSLA'], cta: 'تواصل مع المبيعات' },
    agency: { name: 'Agency', price: 'تواصل مع المبيعات', tagline: 'للوكالات والموزّعين', features: ['لوحة إدارة العملاء', 'تحقق جماعي', 'علامة مشتركة للوكالة', 'فوترة إعادة البيع'], cta: 'تواصل مع المبيعات' },
    compareHeads: { business: 'Business', enterprise: 'Enterprise' },
    rows: { monitoring: 'المراقبة والتنبيهات', api: 'حصة الواجهة البرمجية العامة', certificates: 'شهادات التحقق' },
    selfServeNote: 'دفع Business الذاتي قيد الإطلاق — تواصل مع المبيعات للبدء اليوم.',
  },
}
