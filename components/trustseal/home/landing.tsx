'use client'
// components/trustseal/home/landing.tsx  (asq-trustseal-public-launch)
// Production TrustSeal landing page. Command-Center visual language (dark,
// holographic, hex-seal, band colours). EVERY string is read via t(locale, key) —
// no hardcoded copy — so all four locales render and translations drop in later.
// RTL-safe: the [locale] layout sets dir; this uses logical/centred layout and the
// band colour system shared with the Command Center.
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Locale } from '@/lib/trustseal/locales'
import type { HomeMetrics, FeedItem } from '@/lib/trustseal/home-data'
import { t } from '@/lib/trustseal/messages'

const C = { bg: '#050811', text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee', violet: '#8b5cf6' }
const BAND = { verified: '#34d399', established: '#22d3ee', limited: '#a78bfa', caution: '#fbbf24', risk: '#f87171' }

function HexSeal({ size = 88 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <defs><linearGradient id="hp-seal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={C.cyan} /><stop offset="100%" stopColor={C.violet} /></linearGradient></defs>
      <polygon points="20,3 34,11 34,29 20,37 6,29 6,11" fill="rgba(34,211,238,0.06)" stroke="url(#hp-seal)" strokeWidth="2" />
      <path d="M14 20 l4 4 l8 -9" fill="none" stroke="url(#hp-seal)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const reduce = useReducedMotion()
  // SSR and first paint must show the REAL value (crawlers/no-JS readers see the
  // HTML only — a 0 start makes the platform look dead). Animation kicks in
  // client-side after hydration.
  const [v, setV] = useState(to)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (reduce) return
    let raf = 0, start = 0
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min(1, (ts - start) / 1400)
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, reduce])
  return <span ref={ref} className="tabular-nums">{v.toLocaleString()}{suffix}</span>
}

const card: React.CSSProperties = { background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))', border: '1px solid rgba(120,160,255,0.14)', borderRadius: 16 }

// Honest label for every illustrative preview (SAMPLE / PREVIEW / ILLUSTRATIVE).
function SampleTag({ label }: { label: string }) {
  return <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>{label}</span>
}

// Conversion-pass copy (API + Certificate homepage sections). Self-contained so the
// shared message dicts stay lean; en fallback for any unknown locale.
const CONV: Record<string, { apiH: string; apiS: string; apiCta: string; certH: string; certS: string; certQr: string; certCta: string }> = {
  en: { apiH: 'A trust API anyone can call', apiS: 'Query any domain’s live trust status as JSON — integrate TrustSeal into your checkout, onboarding, or marketplace.', apiCta: 'Read the API docs', certH: 'Verifiable certificates', certS: 'Every verified domain gets a downloadable certificate with a tamper-evident fingerprint and a QR code.', certQr: 'Scan the QR to confirm the certificate against the live public seal — it can’t be forged.', certCta: 'Verify a domain' },
  hi: { apiH: 'एक ट्रस्ट API जिसे कोई भी कॉल कर सके', apiS: 'किसी भी डोमेन की लाइव ट्रस्ट स्थिति को JSON के रूप में क्वेरी करें — TrustSeal को अपने चेकआउट, ऑनबोर्डिंग या मार्केटप्लेस में एकीकृत करें।', apiCta: 'API दस्तावेज़ पढ़ें', certH: 'सत्यापन-योग्य प्रमाणपत्र', certS: 'हर सत्यापित डोमेन को छेड़छाड़-रोधी फिंगरप्रिंट और QR कोड वाला डाउनलोड-योग्य प्रमाणपत्र मिलता है।', certQr: 'लाइव सार्वजनिक सील के विरुद्ध प्रमाणपत्र की पुष्टि के लिए QR स्कैन करें — इसे नकली नहीं बनाया जा सकता।', certCta: 'डोमेन सत्यापित करें' },
  es: { apiH: 'Una API de confianza que cualquiera puede llamar', apiS: 'Consulta el estado de confianza en vivo de cualquier dominio en JSON — integra TrustSeal en tu checkout, onboarding o marketplace.', apiCta: 'Leer la documentación de la API', certH: 'Certificados verificables', certS: 'Cada dominio verificado obtiene un certificado descargable con una huella a prueba de manipulaciones y un código QR.', certQr: 'Escanea el QR para confirmar el certificado contra el sello público en vivo — no se puede falsificar.', certCta: 'Verificar un dominio' },
  ar: { apiH: 'واجهة ثقة برمجية يمكن لأي أحد استدعاؤها', apiS: 'استعلم عن حالة ثقة أي نطاق مباشرةً بصيغة JSON — ادمج TrustSeal في الدفع أو التهيئة أو السوق لديك.', apiCta: 'اقرأ وثائق الواجهة', certH: 'شهادات قابلة للتحقق', certS: 'يحصل كل نطاق موثّق على شهادة قابلة للتنزيل ببصمة مقاومة للعبث ورمز QR.', certQr: 'امسح رمز QR لتأكيد الشهادة مقابل الختم العام الحيّ — لا يمكن تزويرها.', certCta: 'توثيق نطاق' },
}

// Founder Pilot + risk-reversal (self-contained like CONV; en fallback). Honest:
// no testimonials/logos/case studies/numbers — a real, risk-free early-adopter offer.
const PILOT: Record<string, { h: string; s: string; b1: string; b2: string; b3: string; b4: string; cta: string }> = {
  en: {
    h: 'Founder pilot — we set it up with you',
    s: 'We’re onboarding our first businesses personally. Join the founder pilot and we’ll verify your business and configure the badge for you — free for 30 days. If it doesn’t earn its place, walk away: no cost, no lock-in. Early businesses keep founder pricing.',
    b1: 'Free 30-day pilot — no card to start',
    b2: 'We handle setup and verification for you',
    b3: 'Cancel anytime — access runs to period end',
    b4: 'Founder pricing locked for early adopters',
    cta: 'Join the founder pilot',
  },
}

export function TrustSealLanding({ locale = 'en' as Locale, metrics, feed = [] }: { locale?: Locale; metrics?: HomeMetrics; feed?: FeedItem[] }) {
  const x = (k: string) => t(locale, k)
  const cv = CONV[locale] ?? CONV.en
  const pilot = PILOT[locale] ?? PILOT.en
  const L = (sub: string) => `/${locale}${sub}`

  // REAL data (server-provided). Sections hide when there is nothing genuine to show.
  const m: HomeMetrics = metrics ?? { domainsVerified: 0, verificationsRun: 0, certificatesIssued: 0, apiRequestsServed: 0, monitoringChecks: 0 }
  const showFeed = feed.length > 0
  const rel = (ms: number) => {
    const diff = Math.max(0, Date.now() - ms)
    const day = Math.floor(diff / 86_400_000); if (day > 0) return `${day}d`
    const hr = Math.floor(diff / 3_600_000); if (hr > 0) return `${hr}h`
    return `${Math.floor(diff / 60_000)}m`
  }
  // Social proof: show only stats with a meaningful value. Zero never renders,
  // and inventory-style counts (domains/certificates) stay hidden until they
  // reach a minimum — a real but tiny "1" reads as weakness, not proof. Activity
  // metrics (runs/checks/API) are honest at any positive value.
  const metricCards = [
    { label: x('metrics.domainsVerified'), value: m.domainsVerified, min: 3 },
    { label: x('metrics.certificatesIssued'), value: m.certificatesIssued, min: 3 },
    { label: x('metrics.apiRequestsServed'), value: m.apiRequestsServed, min: 1 },
    { label: x('metrics.monitoringChecks'), value: m.monitoringChecks, min: 1 },
    { label: x('metrics.verificationsRun'), value: m.verificationsRun, min: 1 },
  ].filter((c) => c.value >= c.min)
  const showMetrics = metricCards.length > 0

  const levels = [
    { key: 'verified', c: BAND.verified }, { key: 'established', c: BAND.established },
    { key: 'limited', c: BAND.limited }, { key: 'caution', c: BAND.caution }, { key: 'risk', c: BAND.risk },
  ]
  const steps = ['1', '2', '3'].map((n) => ({ title: x(`how.step${n}Title`), body: x(`how.step${n}Body`) }))
  const faqs = ['1', '2', '3', '4', '5'].map((n) => ({ q: x(`faq.q${n}`), a: x(`faq.a${n}`) }))

  const H = 'mx-auto max-w-3xl text-center'

  return (
    <main data-trustseal-landing style={{ background: `radial-gradient(1100px 560px at 70% -10%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(900px 500px at 8% 110%, rgba(139,92,246,0.10), transparent 60%), ${C.bg}`, color: C.text1, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* 1 — HERO */}
      <section className="px-6 pt-20 pb-16 text-center">
        <div className="mx-auto mb-6 grid place-items-center"><HexSeal /></div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: C.cyan }}>{x('hero.eyebrow')}</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">{x('hero.title')}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg" style={{ color: C.text2 }}>{x('hero.subtitle')}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href={L('/verify')} className="rounded-lg px-5 py-2.5 text-sm font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{x('hero.ctaPrimary')}</a>
          <a href={L('/pricing')} className="rounded-lg border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text1 }}>{x('hero.ctaSecondary')}</a>
        </div>
        <p className="mt-4 font-mono text-[11px]" style={{ color: C.text3 }}>{x('hero.note')}</p>
      </section>

      {/* 1b — WHAT YOUR CUSTOMERS WILL SEE (illustrative previews; clearly labeled) */}
      <section className="px-6 py-14">
        <h2 className={`${H} text-2xl font-bold`}>What your customers will see</h2>
        <p className={`${H} mt-2 text-sm`} style={{ color: C.text2 }}>The trust signals visitors can check before they buy — here’s exactly what you publish.</p>
        <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-3">
          {/* Verified Badge */}
          <div className="p-5" style={card}>
            <div className="flex items-center justify-between"><span className="text-xs font-semibold" style={{ color: C.text2 }}>Verified Badge</span><SampleTag label="Sample" /></div>
            <div className="mt-4 grid place-items-center rounded-xl py-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="inline-flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: `1px solid ${BAND.verified}`, background: 'rgba(52,211,153,0.08)' }}>
                <HexSeal size={22} />
                <span className="text-left"><span className="block text-[11px] font-semibold" style={{ color: C.text1 }}>Verified by TrustSeal</span><span className="block text-[9px]" style={{ color: C.text3 }}>example.com · live status</span></span>
                <span aria-hidden style={{ color: BAND.verified }}>✓</span>
              </div>
            </div>
            <p className="mt-3 text-xs" style={{ color: C.text3 }}>Embed on your site. Visitors click it to confirm you’re verified.</p>
          </div>
          {/* Public Verification Page */}
          <div className="p-5" style={card}>
            <div className="flex items-center justify-between"><span className="text-xs font-semibold" style={{ color: C.text2 }}>Public Verification Page</span><SampleTag label="Preview" /></div>
            <div className="mt-4 overflow-hidden rounded-xl" style={{ border: '1px solid rgba(120,160,255,0.14)' }}>
              <div className="flex items-center gap-1 px-2 py-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#f87171' }} /><span className="h-1.5 w-1.5 rounded-full" style={{ background: '#fbbf24' }} /><span className="h-1.5 w-1.5 rounded-full" style={{ background: '#34d399' }} />
                <span className="ms-2 truncate font-mono text-[8px]" style={{ color: C.text3 }}>trustseal…/trust/example.com</span>
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold" style={{ color: C.text1 }}>example.com</div>
                <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${BAND.established}1a`, color: BAND.established }}>Established</span>
                <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: 'rgba(120,160,255,0.15)' }}><div className="h-1.5 rounded-full" style={{ width: '82%', background: BAND.established }} /></div>
                <div className="mt-1 text-[9px]" style={{ color: C.text3 }}>Ownership confirmed · illustrative score</div>
              </div>
            </div>
            <p className="mt-3 text-xs" style={{ color: C.text3 }}>A public page anyone can open to independently verify you.</p>
          </div>
          {/* Certificate */}
          <div className="p-5" style={card}>
            <div className="flex items-center justify-between"><span className="text-xs font-semibold" style={{ color: C.text2 }}>Certificate</span><SampleTag label="Illustrative" /></div>
            <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div>
                <div className="flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold" style={{ background: BAND.established, color: '#06121e' }}>★</span><span className="text-[11px] font-semibold" style={{ color: C.text1 }}>Verification Certificate</span></div>
                <div className="mt-1.5 text-[9px]" style={{ color: C.text3 }}>example.com · Established</div>
                <div className="break-all font-mono text-[9px]" style={{ color: C.text3 }}>773c107f…51c450</div>
              </div>
              <span aria-hidden className="grid h-12 w-12 grid-cols-4 grid-rows-4 gap-px rounded p-1" style={{ background: '#fff' }}>{Array.from({ length: 16 }).map((_, i) => <span key={i} style={{ background: [0, 1, 3, 5, 6, 9, 10, 12, 15].includes(i) ? '#0b0f17' : '#fff' }} />)}</span>
            </div>
            <p className="mt-3 text-xs" style={{ color: C.text3 }}>A downloadable, tamper-evident certificate with a QR to confirm it.</p>
          </div>
        </div>
      </section>

      {/* 1c — YOUR TRUSTSEAL DASHBOARD (interface preview; sample data) */}
      <section className="px-6 py-14">
        <h2 className={`${H} text-2xl font-bold`}>Your TrustSeal dashboard</h2>
        <p className={`${H} mt-2 text-sm`} style={{ color: C.text2 }}>Verify domains, copy your badge, and track status — all in one place.</p>
        <div className="mx-auto mt-8 max-w-3xl overflow-hidden" style={card}>
          <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: 'rgba(120,160,255,0.12)' }}>
            <span className="text-xs font-semibold" style={{ color: C.text2 }}>Dashboard</span><SampleTag label="Preview · sample data" />
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: C.text3 }}>Your domains</div>
              <div className="mt-2 flex items-center justify-between text-xs"><span style={{ color: C.text1 }}>example.com</span><span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: `${BAND.verified}1a`, color: BAND.verified }}>Verified</span></div>
              <div className="mt-1 flex items-center justify-between text-xs"><span style={{ color: C.text1 }}>shop.example</span><span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: `${BAND.caution}1a`, color: BAND.caution }}>Pending DNS</span></div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: C.text3 }}>Add a domain</div>
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: C.text2 }}>1. Enter your domain<br />2. Add the DNS TXT record we show you<br />3. Click verify — your badge goes live</p>
            </div>
          </div>
        </div>
        <p className={`${H} mt-3 text-xs`} style={{ color: C.text3 }}>Interface preview — your real data appears after you sign in and verify.</p>
      </section>

      {/* 2 — METRICS COUNTERS (real platform data; hidden when there is none) */}
      {showMetrics && (
        <section className="px-6 py-14">
          <h2 className={`${H} text-sm font-semibold uppercase tracking-[0.2em]`} style={{ color: C.text2 }}>{x('metrics.heading')}</h2>
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
            {metricCards.map((mc) => (
              <div key={mc.label} className="p-5 text-center" style={card}>
                <div className="text-3xl font-bold" style={{ color: C.text1 }}><Counter to={mc.value} /></div>
                <div className="mt-1 text-xs" style={{ color: C.text3 }}>{mc.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3 — HOW IT WORKS */}
      <section className="px-6 py-14">
        <h2 className={`${H} text-2xl font-bold`}>{x('how.heading')}</h2>
        <p className={`${H} mt-2 text-sm`} style={{ color: C.text2 }}>{x('how.subheading')}</p>
        <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={i} className="p-5" style={card}>
              <div className="grid h-8 w-8 place-items-center rounded-lg font-mono text-sm font-bold" style={{ background: 'rgba(34,211,238,0.12)', color: C.cyan }}>{i + 1}</div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm" style={{ color: C.text2 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 — TRUST LEVELS */}
      <section className="px-6 py-14">
        <h2 className={`${H} text-2xl font-bold`}>{x('levels.heading')}</h2>
        <p className={`${H} mt-2 text-sm`} style={{ color: C.text2 }}>{x('levels.subheading')}</p>
        <div className="mx-auto mt-8 grid max-w-4xl gap-3">
          {levels.map((lv) => (
            <div key={lv.key} className="flex items-center gap-4 p-4" style={card}>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: lv.c, boxShadow: `0 0 10px ${lv.c}` }} />
              <div className="min-w-0">
                <span className="font-semibold" style={{ color: lv.c }}>{x(`levels.${lv.key}Name`)}</span>
                <span className="ms-2 text-sm" style={{ color: C.text2 }}>{x(`levels.${lv.key}Desc`)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4b — PUBLIC TRUST API (conversion: developer/moat surface) */}
      <section className="px-6 py-14">
        <h2 className={`${H} text-2xl font-bold`}>{cv.apiH}</h2>
        <p className={`${H} mt-2 text-sm`} style={{ color: C.text2 }}>{cv.apiS}</p>
        <div className="mx-auto mt-8 max-w-2xl overflow-hidden" style={card}>
          <div className="border-b px-4 py-2 font-mono text-[11px]" style={{ borderColor: 'rgba(56,189,248,0.16)', color: C.cyan }}>GET /api/trust/acme.com</div>
          <pre dir="ltr" className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed" style={{ color: '#cdd8ec' }}>{`{
  "domain": "acme.com",
  "verified": true,
  "trustLevel": "Established",
  "score": 82,
  "verificationDate": "2026-05-01T...",
  "sealUrl": ".../en/trust/acme.com"
}`}</pre>
        </div>
        <div className="mt-6 text-center"><a href={L('/docs')} className="rounded-lg border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.cyan }}>{cv.apiCta}</a></div>
      </section>

      {/* 4c — VERIFIABLE CERTIFICATES (conversion: trust artifact + QR) */}
      <section className="px-6 py-14">
        <h2 className={`${H} text-2xl font-bold`}>{cv.certH}</h2>
        <p className={`${H} mt-2 text-sm`} style={{ color: C.text2 }}>{cv.certS}</p>
        <div className="mx-auto mt-8 grid max-w-2xl items-center gap-5 sm:grid-cols-[1fr_auto]" style={{ ...card, padding: 20 }}>
          <div>
            <div className="flex items-center gap-2">
              <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold" style={{ background: BAND.established, color: '#06121e' }}>★</span>
              <span className="text-sm font-semibold">TrustSeal · Verification Certificate</span>
            </div>
            <dl className="mt-3 space-y-1 text-xs" style={{ color: C.text2 }}>
              <div>Domain · <span style={{ color: C.text1 }}>acme.com</span></div>
              <div>Trust level · <span style={{ color: BAND.established }}>Established</span></div>
              <div className="break-all">Fingerprint · <span className="font-mono">773c107f…51c450c80</span></div>
            </dl>
            <p className="mt-3 text-xs" style={{ color: C.text3 }}>{cv.certQr}</p>
          </div>
          <div aria-hidden className="mx-auto grid h-24 w-24 grid-cols-5 grid-rows-5 gap-0.5 rounded-lg p-2" style={{ background: '#fff' }}>
            {Array.from({ length: 25 }).map((_, i) => (
              <span key={i} style={{ background: [0,1,2,4,5,6,10,12,14,18,20,21,22,24].includes(i) ? '#0b0f17' : '#fff' }} />
            ))}
          </div>
        </div>
        <div className="mt-6 text-center"><a href={L('/verify')} className="rounded-lg px-5 py-2.5 text-sm font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{cv.certCta}</a></div>
      </section>

      {/* 5 — RECENT VERIFICATION FEED (real verified domains; hidden when none) */}
      {showFeed && (
        <section className="px-6 py-14">
          <h2 className={`${H} text-2xl font-bold`}>{x('feed.heading')}</h2>
          <p className={`${H} mt-2 text-sm`} style={{ color: C.text2 }}>{x('feed.subheading')}</p>
          <div className="mx-auto mt-8 max-w-2xl overflow-hidden" style={{ ...card, background: 'linear-gradient(160deg, rgba(8,14,26,0.9), rgba(6,10,20,0.7))' }}>
            <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'rgba(56,189,248,0.16)' }}>
              <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: C.cyan }}>INTEL://verification.stream</span>
              <span className="ms-auto inline-flex items-center gap-1.5 font-mono text-[9px]" style={{ color: BAND.verified }}>
                <motion.span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: BAND.verified }} animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />{x('feed.streaming')}
              </span>
            </div>
            <ul className="px-3 py-2 font-mono text-[11px] leading-relaxed">
              {feed.map((f) => (
                <li key={f.domain} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="rounded px-1" style={{ color: BAND.verified, background: `${BAND.verified}14` }}>VRFY</span>
                  <a className="break-all" href={`${L('/trust')}/${encodeURIComponent(f.domain)}`} style={{ color: '#cdd8ec' }}>{f.domain}</a>
                  <span style={{ color: C.text3 }}>· {rel(f.verifiedAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 6 — TRUST NETWORK */}
      <section className="px-6 py-14 text-center">
        <h2 className={`${H} text-2xl font-bold`}>{x('network.heading')}</h2>
        <p className={`${H} mt-2 text-sm`} style={{ color: C.text2 }}>{x('network.subheading')}</p>
        <div className="mx-auto mt-8 grid max-w-md place-items-center"><HexSeal size={120} /></div>
        <div className="mt-6"><a href={L('/command')} className="rounded-lg border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.cyan }}>{x('network.cta')}</a></div>
      </section>

      {/* 6b — FOUNDER PILOT + RISK REVERSAL (honest early-adopter offer) */}
      <section className="px-6 py-14">
        <div className="mx-auto max-w-3xl p-7" style={{ ...card, border: `2px solid ${C.cyan}` }}>
          <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ background: 'rgba(34,211,238,0.12)', color: C.cyan }}>Limited · founder pilot</span>
          <h2 className="mt-3 text-2xl font-bold">{pilot.h}</h2>
          <p className="mt-2 text-sm" style={{ color: C.text2 }}>{pilot.s}</p>
          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {[pilot.b1, pilot.b2, pilot.b3, pilot.b4].map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm" style={{ color: C.text1 }}>
                <span aria-hidden style={{ color: BAND.verified }}>✓</span><span>{b}</span>
              </li>
            ))}
          </ul>
          <a href={L('/enterprise')} className="mt-6 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{pilot.cta}</a>
        </div>
      </section>

      {/* 7 — PRICING */}
      <section className="px-6 py-14">
        <h2 className={`${H} text-2xl font-bold`}>{x('pricing.heading')}</h2>
        <p className={`${H} mt-2 text-sm`} style={{ color: C.text2 }}>{x('pricing.subheading')}</p>
        <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
          <div className="p-6" style={card}>
            <h3 className="text-lg font-semibold">{x('pricing.freeName')}</h3>
            <p className="text-xs" style={{ color: C.text3 }}>{x('pricing.freeTagline')}</p>
            <p className="mt-3 text-3xl font-bold">{x('pricing.freePrice')}</p>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: C.text2 }}>
              <li>{x('pricing.freeF1')}</li><li>{x('pricing.freeF2')}</li><li>{x('pricing.freeF3')}</li>
            </ul>
            <a href={L('/dashboard')} className="mt-6 block rounded-lg border px-4 py-2 text-center text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text1 }}>{x('pricing.freeCta')}</a>
          </div>
          <div className="relative p-6" style={{ ...card, border: `2px solid ${C.cyan}` }}>
            <span className="absolute -top-3 start-4 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{x('pricing.yearlyBadge')}</span>
            <h3 className="text-lg font-semibold">{x('pricing.proName')}</h3>
            <p className="text-xs" style={{ color: C.text3 }}>{x('pricing.proTagline')}</p>
            <p className="mt-3 text-3xl font-bold">{x('pricing.proPriceMonthly')}</p>
            <p className="text-xs" style={{ color: C.text3 }}>{x('pricing.proPriceYearly')}</p>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: C.text2 }}>
              <li>{x('pricing.proF1')}</li><li>{x('pricing.proF2')}</li><li>{x('pricing.proF3')}</li><li>{x('pricing.proF4')}</li>
            </ul>
            <a href={L('/dashboard')} className="mt-6 block rounded-lg px-4 py-2 text-center text-sm font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{x('pricing.proCta')}</a>
          </div>
        </div>
        <p className={`${H} mt-4 text-xs`} style={{ color: C.text3 }}>{x('pricing.gstNote')}</p>
      </section>

      {/* 8 — FAQ */}
      <section className="px-6 py-14">
        <h2 className={`${H} text-2xl font-bold`}>{x('faq.heading')}</h2>
        <div className="mx-auto mt-8 grid max-w-3xl gap-3">
          {faqs.map((f, i) => (
            <details key={i} className="p-4" style={card}>
              <summary className="cursor-pointer text-sm font-semibold" style={{ color: C.text1 }}>{f.q}</summary>
              <p className="mt-2 text-sm" style={{ color: C.text2 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 9 — CTA */}
      <section className="px-6 py-16 text-center">
        <h2 className={`${H} text-2xl font-bold sm:text-3xl`}>{x('cta.heading')}</h2>
        <p className={`${H} mt-3 text-sm`} style={{ color: C.text2 }}>{x('cta.subheading')}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a href={L('/verify')} className="rounded-lg px-5 py-2.5 text-sm font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{x('cta.primary')}</a>
          <a href={L('/enterprise')} className="rounded-lg border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text1 }}>{x('cta.secondary')}</a>
        </div>
      </section>

      {/* Footer is provided globally by the [locale] layout (TrustSealFooter). */}
    </main>
  )
}
