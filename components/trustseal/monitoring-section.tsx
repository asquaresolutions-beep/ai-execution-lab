'use client'
// components/trustseal/monitoring-section.tsx  (asq-trustseal-phase5)
// Dashboard monitoring panel — the Business-tier value proposition. Entitled
// accounts see live monitoring status + recent alerts (SSL/DNS/trust-level/score
// changes, reverification-due). Non-entitled accounts see the Business upsell.
// Localized via a self-contained label map (no edits to the shared message dicts).
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { type Locale } from '@/lib/trustseal/locales'
import { formatDate } from '@/lib/trustseal/format'

interface Alert { id: string; domain: string; kind: string; severity: 'info' | 'warning' | 'critical'; detail: string; createdAt: number }
interface MonInfo { entitled: boolean; alerts: Alert[] }

const card = { borderColor: 'rgb(var(--ts-border))', backgroundColor: 'rgb(var(--ts-surface-2))' } as const
const SEV_COLOR: Record<string, string> = { critical: '#f87171', warning: '#fbbf24', info: 'rgb(var(--ts-accent))' }

type L = {
  title: string; active: string; allClear: string; upsellTitle: string; upsellBody: string
  businessName: string; price: string; features: string[]; cta: string
}
const LABELS: Record<Locale, L> = {
  en: {
    title: 'Monitoring', active: 'Active', allClear: 'All clear — no alerts. Your domains are being monitored continuously.',
    upsellTitle: 'Continuous monitoring', upsellBody: 'Get alerted the moment a verified domain’s SSL, DNS, trust level, or score changes — before your customers notice.',
    businessName: 'Business', price: '₹1,999/mo',
    features: ['Up to 10 domains', 'SSL · DNS · nameserver monitoring', 'Trust-level & score-change alerts', 'Email notifications', 'API access · certificates · trust history'],
    cta: 'Contact sales to upgrade',
  },
  hi: {
    title: 'मॉनिटरिंग', active: 'सक्रिय', allClear: 'सब ठीक है — कोई अलर्ट नहीं। आपके डोमेन की निरंतर निगरानी हो रही है।',
    upsellTitle: 'निरंतर निगरानी', upsellBody: 'जैसे ही किसी सत्यापित डोमेन का SSL, DNS, ट्रस्ट स्तर या स्कोर बदले, तुरंत अलर्ट पाएं — ग्राहकों के ध्यान देने से पहले।',
    businessName: 'बिज़नेस', price: '₹1,999/माह',
    features: ['10 डोमेन तक', 'SSL · DNS · नेमसर्वर निगरानी', 'ट्रस्ट-स्तर व स्कोर-परिवर्तन अलर्ट', 'ईमेल सूचनाएं', 'API एक्सेस · प्रमाणपत्र · ट्रस्ट इतिहास'],
    cta: 'अपग्रेड के लिए सेल्स से संपर्क करें',
  },
  es: {
    title: 'Monitoreo', active: 'Activo', allClear: 'Todo en orden — sin alertas. Tus dominios se monitorean continuamente.',
    upsellTitle: 'Monitoreo continuo', upsellBody: 'Recibe una alerta en cuanto cambie el SSL, DNS, nivel de confianza o puntaje de un dominio verificado — antes de que lo noten tus clientes.',
    businessName: 'Business', price: '₹1,999/mes',
    features: ['Hasta 10 dominios', 'Monitoreo de SSL · DNS · servidores de nombres', 'Alertas de cambios de nivel y puntaje', 'Notificaciones por correo', 'Acceso a API · certificados · historial'],
    cta: 'Contacta a ventas para mejorar',
  },
  ar: {
    title: 'المراقبة', active: 'مفعّلة', allClear: 'كل شيء على ما يرام — لا تنبيهات. تتم مراقبة نطاقاتك باستمرار.',
    upsellTitle: 'مراقبة مستمرة', upsellBody: 'احصل على تنبيه فور تغيّر SSL أو DNS أو مستوى الثقة أو الدرجة لأي نطاق موثّق — قبل أن يلاحظ عملاؤك.',
    businessName: 'Business', price: '₹1,999/شهر',
    features: ['حتى 10 نطاقات', 'مراقبة SSL · DNS · خوادم الأسماء', 'تنبيهات تغيّر المستوى والدرجة', 'إشعارات بريدية', 'وصول API · شهادات · سجل الثقة'],
    cta: 'تواصل مع المبيعات للترقية',
  },
}

export function MonitoringSection({ locale = 'en' as Locale }: { locale?: Locale }) {
  const t = LABELS[locale] ?? LABELS.en
  const { user } = useAuth()
  const [info, setInfo] = useState<MonInfo | null>(null)

  const load = useCallback(async () => {
    if (!user?.idToken) return
    try {
      const r = await fetch('/api/trustseal/monitoring', { headers: { Authorization: `Bearer ${user.idToken}` }, cache: 'no-store' })
      if (r.ok) setInfo((await r.json()) as MonInfo)
    } catch { /* non-critical */ }
  }, [user?.idToken])
  useEffect(() => { void load() }, [load])

  if (!user || !info) return null

  // ── Upsell (not entitled): Business value proposition ──
  if (!info.entitled) {
    return (
      <section data-monitoring className="rounded-xl border p-5" style={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{t.upsellTitle}</h2>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid #22d3ee' }}>{t.businessName} · {t.price}</span>
        </div>
        <p className="mt-2 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>{t.upsellBody}</p>
        <ul className="mt-3 space-y-1">
          {t.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'rgb(var(--ts-text-1))' }}>
              <span aria-hidden style={{ color: '#22d3ee' }}>✓</span>{f}
            </li>
          ))}
        </ul>
        <a href="mailto:contact@asquaresolution.com?subject=TrustSeal%20Business"
          className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'rgb(var(--ts-accent))', color: '#06121e' }}>
          {t.cta}
        </a>
      </section>
    )
  }

  // ── Entitled: monitoring status + alerts ──
  return (
    <section data-monitoring className="rounded-xl border p-5" style={card}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{t.title}</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid #34d399' }}>
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#34d399' }} />{t.active}
        </span>
      </div>
      {info.alerts.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>{t.allClear}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {info.alerts.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <span aria-hidden className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: SEV_COLOR[a.severity] }} />
              <div>
                <p className="text-sm" style={{ color: 'rgb(var(--ts-text-1))' }}><strong>{a.domain}</strong> · {a.detail}</p>
                <p className="text-xs" style={{ color: 'rgb(var(--ts-text-3))' }}>{formatDate(locale, a.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
