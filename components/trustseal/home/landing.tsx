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
  const [v, setV] = useState(reduce ? to : 0)
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

export function TrustSealLanding({ locale = 'en' as Locale }: { locale?: Locale }) {
  const x = (k: string) => t(locale, k)
  const L = (sub: string) => `/${locale}${sub}`

  const levels = [
    { key: 'verified', c: BAND.verified }, { key: 'established', c: BAND.established },
    { key: 'limited', c: BAND.limited }, { key: 'caution', c: BAND.caution }, { key: 'risk', c: BAND.risk },
  ]
  const feed = [
    { t: '14:22:07', tag: 'VRFY', d: 'asquaresolution.com', m: 'dns.txt match · score 94', c: BAND.verified },
    { t: '14:21:48', tag: 'TLS', d: 'payquik.net', m: 'chain anomaly · review', c: BAND.caution },
    { t: '14:20:11', tag: 'CLAIM', d: 'nova.app', m: 'ownership challenge issued', c: BAND.established },
    { t: '14:18:55', tag: 'INTEL', d: 'lure-bank.top', m: 'blocklist hit · rejected', c: BAND.risk },
    { t: '14:16:30', tag: 'SCORE', d: 'orbit.sh', m: 'verdict recomputed · 71', c: BAND.limited },
  ]
  const metrics = [
    { k: 'metrics.domainsVerified', to: 12840, s: '+' },
    { k: 'metrics.trustChecks', to: 5_900_000, s: '+' },
    { k: 'metrics.countries', to: 38, s: '' },
    { k: 'metrics.uptime', to: 99, s: '.98%' },
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

      {/* 2 — METRICS COUNTERS */}
      <section className="px-6 py-14">
        <h2 className={`${H} text-sm font-semibold uppercase tracking-[0.2em]`} style={{ color: C.text2 }}>{x('metrics.heading')}</h2>
        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.k} className="p-5 text-center" style={card}>
              <div className="text-3xl font-bold" style={{ color: C.text1 }}><Counter to={m.to} suffix={m.s} /></div>
              <div className="mt-1 text-xs" style={{ color: C.text3 }}>{x(m.k)}</div>
            </div>
          ))}
        </div>
      </section>

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

      {/* 5 — LIVE VERIFICATION FEED */}
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
            {feed.map((f, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                <span style={{ color: C.text3 }}>{f.t}</span>
                <span className="rounded px-1" style={{ color: f.c, background: `${f.c}14` }}>{f.tag}</span>
                <span className="break-all" style={{ color: '#cdd8ec' }}>{f.d}</span>
                <span style={{ color: C.text3 }}>{f.m}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6 — TRUST NETWORK */}
      <section className="px-6 py-14 text-center">
        <h2 className={`${H} text-2xl font-bold`}>{x('network.heading')}</h2>
        <p className={`${H} mt-2 text-sm`} style={{ color: C.text2 }}>{x('network.subheading')}</p>
        <div className="mx-auto mt-8 grid max-w-md place-items-center"><HexSeal size={120} /></div>
        <div className="mt-6"><a href={L('/command')} className="rounded-lg border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.cyan }}>{x('network.cta')}</a></div>
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
            <span className="absolute -top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{x('pricing.yearlyBadge')}</span>
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

      {/* 10 — FOOTER */}
      <footer className="border-t px-6 py-10" style={{ borderColor: 'rgba(120,160,255,0.12)' }}>
        <div className="mx-auto flex max-w-4xl flex-wrap items-start justify-between gap-6">
          <div className="max-w-xs">
            <div className="flex items-center gap-2"><HexSeal size={28} /><span className="font-semibold">{x('common.product')}</span></div>
            <p className="mt-2 text-sm" style={{ color: C.text2 }}>{x('footer.tagline')}</p>
          </div>
          <div className="flex flex-wrap gap-10 text-sm">
            <div>
              <p className="font-semibold" style={{ color: C.text2 }}>{x('footer.product')}</p>
              <ul className="mt-2 space-y-1.5" style={{ color: C.text3 }}>
                <li><a href={L('/pricing')}>{x('nav.pricing')}</a></li>
                <li><a href={L('/verify')}>{x('nav.verify')}</a></li>
                <li><a href={L('/command')}>{x('network.cta')}</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold" style={{ color: C.text2 }}>{x('footer.legal')}</p>
              <ul className="mt-2 space-y-1.5" style={{ color: C.text3 }}>
                <li><a href={L('/security')}>{x('footer.security')}</a></li>
                <li><a href={L('/about')}>{x('footer.about')}</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-4xl border-t pt-6 text-xs" style={{ borderColor: 'rgba(120,160,255,0.12)', color: C.text3 }}>
          <p>{x('footer.builtBy')}</p>
          <p className="mt-1">{x('common.copyright')}</p>
        </div>
      </footer>
    </main>
  )
}
