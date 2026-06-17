'use client'
// components/trustseal/home/verify-view.tsx  (asq-trustseal-growth)
// Real /verify page. Public domain-lookup now CHECKS status via the public Trust
// API: verified → opens the seal page; unverified → an inline "Not verified yet"
// conversion panel (benefits + claim / invite / upgrade CTAs) instead of a 404.
// Existing form copy stays in the `verify` namespace; the new panel uses a
// self-contained label map (no edits to shared localization).
import { useState } from 'react'
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

const C = { bg: '#050811', text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee', amber: '#fbbf24' }
const card: React.CSSProperties = { background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))', border: '1px solid rgba(120,160,255,0.14)', borderRadius: 16 }

function normalize(input: string): string | null {
  const d = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null
}

type NV = { notVerified: string; body: string; benefitsTitle: string; benefits: string[]; claim: string; invite: string; upgrade: string; checking: string; tryAnother: string }
const NV_LABELS: Record<Locale, NV> = {
  en: { notVerified: 'Not verified yet', body: 'isn’t verified with TrustSeal yet.', benefitsTitle: 'Why verify with TrustSeal', benefits: ['Prove domain ownership via DNS', 'Earn an explainable trust score', 'Publish a live badge & public seal page', 'Continuous monitoring & alerts'], claim: 'Claim this domain', invite: 'Invite this business', upgrade: 'See plans', checking: 'Checking…', tryAnother: 'Check another domain' },
  hi: { notVerified: 'अभी सत्यापित नहीं', body: 'अभी TrustSeal से सत्यापित नहीं है।', benefitsTitle: 'TrustSeal से सत्यापन क्यों', benefits: ['DNS के ज़रिए डोमेन स्वामित्व सिद्ध करें', 'एक स्पष्ट ट्रस्ट स्कोर पाएं', 'लाइव बैज और सार्वजनिक सील पेज प्रकाशित करें', 'निरंतर निगरानी और अलर्ट'], claim: 'इस डोमेन का दावा करें', invite: 'इस व्यवसाय को आमंत्रित करें', upgrade: 'प्लान देखें', checking: 'जाँच हो रही है…', tryAnother: 'दूसरा डोमेन जाँचें' },
  es: { notVerified: 'Aún no verificado', body: 'aún no está verificado con TrustSeal.', benefitsTitle: 'Por qué verificar con TrustSeal', benefits: ['Prueba la propiedad del dominio vía DNS', 'Obtén un puntaje de confianza explicable', 'Publica una insignia y página de sello públicas', 'Monitoreo y alertas continuos'], claim: 'Reclamar este dominio', invite: 'Invitar a esta empresa', upgrade: 'Ver planes', checking: 'Comprobando…', tryAnother: 'Comprobar otro dominio' },
  ar: { notVerified: 'غير موثّق بعد', body: 'غير موثّق بعد لدى TrustSeal.', benefitsTitle: 'لماذا التوثيق مع TrustSeal', benefits: ['إثبات ملكية النطاق عبر DNS', 'احصل على درجة ثقة قابلة للتفسير', 'انشر شارة حيّة وصفحة ختم عامة', 'مراقبة وتنبيهات مستمرة'], claim: 'المطالبة بهذا النطاق', invite: 'دعوة هذا النشاط التجاري', upgrade: 'عرض الخطط', checking: 'جارٍ الفحص…', tryAnother: 'فحص نطاق آخر' },
}

export function VerifyView({ locale = 'en' as Locale }: { locale?: Locale }) {
  const x = (k: string) => t(locale, k)
  const nv = NV_LABELS[locale] ?? NV_LABELS.en
  const [val, setVal] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [unverified, setUnverified] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const d = normalize(val)
    if (!d) { setErr(x('verify.invalidDomain')); return }
    setErr(null); setUnverified(null); setBusy(true)
    try {
      const r = await fetch(`/api/trust/${encodeURIComponent(d)}`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (j && j.verified) { window.location.href = `/${locale}/trust/${encodeURIComponent(d)}`; return }
      setUnverified(d) // show the conversion panel instead of a 404
    } catch {
      // On a lookup error, fall back to the seal page (which handles its own state).
      window.location.href = `/${locale}/trust/${encodeURIComponent(d)}`
    } finally { setBusy(false) }
  }

  const inviteHref = unverified
    ? `mailto:?subject=${encodeURIComponent('Get verified on TrustSeal')}&body=${encodeURIComponent(`I checked ${unverified} on TrustSeal — it isn’t verified yet. You can verify domain ownership and publish a trust badge at https://trustseal.asquaresolution.com/${locale}/verify`)}`
    : '#'

  return (
    <main className="px-6 py-16" style={{ background: `radial-gradient(1100px 560px at 70% -10%, rgba(56,189,248,0.10), transparent 60%), ${C.bg}`, color: C.text1, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <h1 className="mx-auto max-w-3xl text-center text-3xl font-bold sm:text-4xl">{x('verify.title')}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm" style={{ color: C.text2 }}>{x('verify.subtitle')}</p>

      <form onSubmit={submit} className="mx-auto mt-10 max-w-xl p-6" style={card}>
        <label htmlFor="ts-verify-domain" className="block text-sm font-semibold">{x('verify.lookupLabel')}</label>
        <div className="mt-3 flex flex-wrap gap-3">
          <input id="ts-verify-domain" value={val} onChange={(e) => { setVal(e.target.value); setErr(null); setUnverified(null) }}
            inputMode="url" placeholder={x('verify.lookupPlaceholder')} aria-label={x('verify.lookupLabel')}
            className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'rgba(120,160,255,0.25)', color: C.text1 }} />
          <button type="submit" disabled={busy} className="rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: C.cyan, color: '#06121e' }}>{busy ? nv.checking : x('verify.lookupCta')}</button>
        </div>
        {err
          ? <p className="mt-2 text-xs" style={{ color: '#f87171' }}>{err}</p>
          : <p className="mt-2 text-xs" style={{ color: C.text3 }}>{x('verify.lookupHint')}</p>}
      </form>

      {/* Unverified → conversion panel (replaces the old 404 dead-end) */}
      {unverified && (
        <div className="mx-auto mt-6 max-w-xl p-6" style={{ ...card, border: `1px solid ${C.amber}` }} data-unverified>
          <div className="flex items-center gap-2">
            <span aria-hidden style={{ color: C.amber }}>●</span>
            <h2 className="font-semibold">{nv.notVerified}</h2>
          </div>
          <p className="mt-1 text-sm" style={{ color: C.text2 }}><strong style={{ color: C.text1 }}>{unverified}</strong> {nv.body}</p>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide" style={{ color: C.text3 }}>{nv.benefitsTitle}</p>
          <ul className="mt-2 space-y-1 text-sm" style={{ color: C.text2 }}>
            {nv.benefits.map((b) => <li key={b} className="flex items-start gap-2"><span aria-hidden style={{ color: C.cyan }}>✓</span>{b}</li>)}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={`/${locale}/dashboard`} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{nv.claim}</a>
            <a href={inviteHref} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text1 }}>{nv.invite}</a>
            <a href={`/${locale}/pricing`} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text1 }}>{nv.upgrade}</a>
          </div>
        </div>
      )}

      <div className="mx-auto mt-6 max-w-xl p-6 text-center" style={card}>
        <h2 className="font-semibold">{x('verify.ownTitle')}</h2>
        <p className="mt-1.5 text-sm" style={{ color: C.text2 }}>{x('verify.ownBody')}</p>
        <a href={`/${locale}/dashboard`} className="mt-4 inline-block rounded-lg border px-5 py-2 text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.cyan }}>{x('verify.ownCta')}</a>
      </div>
    </main>
  )
}
