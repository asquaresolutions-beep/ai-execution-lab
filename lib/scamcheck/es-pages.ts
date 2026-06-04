// ─────────────────────────────────────────────────────────────────
// lib/scamcheck/es-pages.ts
// Spanish (es) SEO landing pages for LATAM + Spain + US-Hispanic traffic.
// Pure data → static pages with Spanish metadata, FAQ schema, and hreflang back
// to the English equivalents. Slugs are Spanish-friendly (e.g. /es/link-checker).
// ─────────────────────────────────────────────────────────────────

import type { CheckerTab } from '@/lib/scamcheck/checkers'

export interface EsChecker {
  slug: string          // Spanish path segment, e.g. 'link-checker' → /es/link-checker
  enSlug: string        // English equivalent for hreflang, e.g. 'link-scam-checker'
  tab: CheckerTab       // QuickAnalyzer initial tab
  h1: string
  title: string
  description: string
  intro: string
  redFlags: string[]
  faqs: { q: string; a: string }[]
}

export const ES_CHECKERS: EsChecker[] = [
  {
    slug: 'link-checker', enSlug: 'link-scam-checker', tab: 'link',
    h1: 'Verificador de enlaces de estafa',
    title: 'Verificador de Enlaces de Estafa — ¿Es seguro este enlace? | ScamCheck',
    description: 'Comprueba gratis si un enlace es una estafa o phishing. Detecta dominios falsos, acortadores sospechosos y páginas de robo de datos al instante.',
    intro: 'Pega cualquier enlace sospechoso (SMS, WhatsApp, correo o redes sociales). ScamCheck analiza el dominio, detecta imitaciones de marcas (typosquatting, homóglifos) y te dice el nivel de riesgo al instante y gratis.',
    redFlags: ['Acortadores (bit.ly, tinyurl) o dominios raros (.xyz, .top, .click)', 'Nombre de marca como subdominio con otro dominio raíz', 'Marcas mal escritas o con caracteres cambiados', 'http:// (sin HTTPS) en una página de "banco"'],
    faqs: [
      { q: '¿Es gratis el verificador de enlaces?', a: 'Sí. Puedes comprobar enlaces gratis cada día; al iniciar sesión obtienes más análisis.' },
      { q: '¿Cómo sé si un enlace es una estafa?', a: 'Pega el enlace: ScamCheck revisa el dominio real (la parte antes del .com/.es), detecta imitaciones y acortadores, y muestra el riesgo y por qué.' },
      { q: '¿Guardan los enlaces que analizo?', a: 'No almacenamos imágenes; solo conservamos metadatos de análisis para mejorar la detección y prevenir abusos.' },
    ],
  },
  {
    slug: 'email-checker', enSlug: 'email-scam-checker', tab: 'email',
    h1: 'Verificador de correos de estafa',
    title: 'Verificador de Correos de Estafa y Phishing | ScamCheck',
    description: 'Comprueba gratis si un correo es phishing o estafa. Detecta remitentes falsos, dominios imitadores y enlaces de robo de credenciales.',
    intro: 'Pega el correo o la dirección del remitente sospechoso. ScamCheck revisa el dominio del remitente, detecta dominios imitadores y señales de phishing, y te indica el riesgo al instante.',
    redFlags: ['Dominio del remitente que no es el oficial de la marca', 'Saludos genéricos + exigencias urgentes', 'Dirección "de" imitadora o con guiones extra', 'Solicitudes de inicio de sesión, tarjeta o datos personales'],
    faqs: [
      { q: '¿Es gratis?', a: 'Sí, puedes comprobar correos gratis cada día. Inicia sesión para obtener más análisis diarios.' },
      { q: '¿Cómo detecto un correo de phishing?', a: 'Revisa el dominio exacto del remitente: el correo oficial llega del dominio real de la marca, no de uno parecido con guiones o palabras añadidas.' },
    ],
  },
  {
    slug: 'phone-checker', enSlug: 'phone-scam-checker', tab: 'phone',
    h1: 'Verificador de números de estafa',
    title: 'Verificador de Números y Llamadas de Estafa | ScamCheck',
    description: 'Comprueba gratis si un número o llamada es una estafa. Detecta números de devolución de llamada falsos y fraudes de soporte técnico.',
    intro: 'Pega el número o el mensaje con un número de contacto sospechoso. ScamCheck detecta patrones de fraude (devoluciones de llamada falsas, soporte técnico falso, peticiones de OTP) y te indica el riesgo.',
    redFlags: ['Números de devolución de llamada en mensajes no solicitados', 'Peticiones de instalar apps de acceso remoto', 'Exigencia de OTP o pagos de "verificación"', 'Llamadas de alta presión ("actúa ahora")'],
    faqs: [
      { q: '¿Es gratis?', a: 'Sí. Análisis gratuitos diarios; inicia sesión para obtener más.' },
      { q: '¿Qué hago si me llaman de un número sospechoso?', a: 'Nunca devuelvas la llamada a números de mensajes no solicitados. Usa el número oficial del sitio web o de tu tarjeta, y nunca compartas un OTP.' },
    ],
  },
  {
    slug: 'whatsapp-checker', enSlug: 'whatsapp-scam-checker', tab: 'message',
    h1: 'Verificador de estafas de WhatsApp',
    title: 'Verificador de Estafas de WhatsApp — ¿Es una estafa este mensaje? | ScamCheck',
    description: 'Comprueba gratis si un mensaje de WhatsApp es una estafa. Detecta phishing, reembolsos falsos, fraudes de empleo e imitación de marcas.',
    intro: 'Pega cualquier mensaje de WhatsApp sospechoso. ScamCheck lo lee, extrae enlaces, números y datos, detecta señales de fraude y te dice el riesgo al instante y gratis.',
    redFlags: ['Urgencia y amenazas ("bloqueado hoy", "en 24 horas")', 'Enlaces a dominios no oficiales o acortados', 'Solicitudes de OTP/PIN/datos', 'Ofertas de premios o empleo inesperadas'],
    faqs: [
      { q: '¿Es gratis?', a: 'Sí. Comprobaciones gratuitas cada día; inicia sesión para obtener más.' },
      { q: '¿Cómo sé si un mensaje de WhatsApp es estafa?', a: 'Pega el mensaje o sube una captura. ScamCheck extrae enlaces/números, detecta señales de fraude y muestra el riesgo y el motivo.' },
    ],
  },
]

export function allEsCheckerSlugs(): string[] { return ES_CHECKERS.map((c) => c.slug) }
export function getEsChecker(slug: string): EsChecker | undefined { return ES_CHECKERS.find((c) => c.slug === slug) }

// Spanish homepage FAQ (also emitted as FAQPage schema).
export const ES_HOME_FAQ: { q: string; a: string }[] = [
  { q: '¿ScamCheck es gratis?', a: 'Sí. Los invitados tienen análisis gratuitos cada día; al iniciar sesión obtienes más. Los análisis de capturas (visión por IA) cuestan más créditos que los de texto.' },
  { q: '¿Cómo compruebo si un mensaje es una estafa?', a: 'Pega el mensaje, enlace, correo o número en el escáner, o sube una captura. ScamCheck extrae enlaces/números, detecta señales de fraude y muestra el riesgo y por qué.' },
  { q: '¿Guardan mis capturas?', a: 'No. Las imágenes se optimizan en tu dispositivo y se procesan en la solicitud; no se almacenan.' },
  { q: '¿Qué estafas detecta?', a: 'Estafas de WhatsApp, SMS, banca, inversión y mensajería, enlaces de phishing, imitación de marcas (dominios parecidos) y trampas de robo de OTP.' },
]
