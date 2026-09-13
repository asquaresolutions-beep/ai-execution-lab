'use client'
// components/trustseal/command/command-center.tsx  (asq-trustseal-command-phase2 → live)
// "Trust Intelligence Command Center". Visual language unchanged: the Trust Network
// is the HERO with a holographic core over an animated cyber-grid with a floating
// particle field, glassmorphism panels and an intel-terminal feed. Framer Motion +
// SVG/CSS only, no new deps, honors prefers-reduced-motion.
//
// DATA: rendered inside CommandGate (server-checked entitlement). Loads the signed-in
// account's own data from GET /api/trustseal/command/overview, whose server-side
// `mode` decides what is shown:
//   • LIVE    — the account has ≥1 verified domain → every value comes from that
//               account's real TrustSeal data; no SAMPLE badge, banner or fixtures.
//   • PREVIEW — no verified domain yet → the hero/terminal/metrics use fictional
//               example.test fixtures, clearly labelled, with a verify CTA. The
//               sidebar sections (Domains, Verifications, Risk, Settings) stay real.
// A failed load shows an error with retry — never sample data.
import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '@/components/auth/auth-provider'
import { HeroNetwork, SAMPLE_HERO } from '@/components/trustseal/command/hero-network'
import { IntelTerminal, SAMPLE_ROWS } from '@/components/trustseal/command/intel-terminal'
import { TrustScoreCards, RiskPanel, LiveRiskPanel, VerificationTimeline, LiveDot, SAMPLE_METRICS, SAMPLE_TIMELINE, toneColor } from '@/components/trustseal/command/widgets'
import { DomainsSection, VerificationsSection, RiskSection, NetworkSection, TimelineSection, SettingsSection } from '@/components/trustseal/command/command-sections'
import { AccountMenu } from '@/components/trustseal/command/account-menu'
import { CommandSearchInput, CommandSearchResults } from '@/components/trustseal/command/command-search'
import { useCommandOverview } from '@/components/trustseal/command/use-command-overview'
import type { CommandDomain, CommandOverview } from '@/lib/trustseal/command/types'
import { bandColor, bandName, categoryNodes, describeEvent, liveMetrics, primaryDomain, verifiedDomains } from '@/lib/trustseal/command/view-model'
import { formatDate } from '@/lib/trustseal/format'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'

const C = { text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee', violet: '#a78bfa', good: '#34d399' }

const NAV = [
  { icon: '◎', label: 'Overview' },
  { icon: '◫', label: 'Domains' },
  { icon: '✓', label: 'Verifications' },
  { icon: '⚠', label: 'Risk' },
  { icon: '⬡', label: 'Network' },
  { icon: '◷', label: 'Timeline' },
  { icon: '⚙', label: 'Settings' },
] as const

type Section = (typeof NAV)[number]['label']
const SECTIONS = NAV.map((n) => n.label) as Section[]

// Deterministic floating intelligence-particle field (HTML layer, behind content).
const PARTICLES = Array.from({ length: 34 }, (_, i) => ({
  left: (i * 2.937) % 100, top: (i * 6.131) % 100,
  size: (i % 3) + 1.5, dur: 9 + (i % 7) * 2.2, delay: (i % 11) * 0.7,
  hue: i % 4 === 0 ? 'rgba(167,139,250,0.5)' : 'rgba(56,189,248,0.5)',
}))

function AnimatedBackdrop() {
  const reduce = useReducedMotion()
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base gradient */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(1200px 640px at 70% -12%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(900px 520px at 8% 112%, rgba(139,92,246,0.12), transparent 60%), #050811' }} />

      {/* animated cyber-grid (subtle perspective drift) */}
      <motion.div className="absolute inset-0 opacity-[0.55]" style={{
        backgroundImage: 'linear-gradient(rgba(120,160,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,255,0.07) 1px, transparent 1px)',
        backgroundSize: '46px 46px', maskImage: 'radial-gradient(circle at 50% 24%, #000 0%, transparent 78%)', WebkitMaskImage: 'radial-gradient(circle at 50% 24%, #000 0%, transparent 78%)',
      }} animate={reduce ? undefined : { backgroundPosition: ['0px 0px', '46px 46px'] }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} />

      {/* fine scanline wash for the "radar" feel */}
      <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(120,160,255,0.035) 0px, rgba(120,160,255,0.035) 1px, transparent 1px, transparent 4px)' }} />

      {/* floating intelligence particles */}
      {!reduce && PARTICLES.map((p, i) => (
        <motion.span key={i} className="absolute rounded-full" style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, background: p.hue, boxShadow: `0 0 6px ${p.hue}` }}
          animate={{ y: [0, -26, 0], opacity: [0.15, 0.6, 0.15] }} transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }} />
      ))}

      {/* drifting aurora */}
      {!reduce && (
        <motion.div className="absolute -top-40 left-1/3 h-[36rem] w-[36rem] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.10), transparent 60%)', filter: 'blur(40px)' }}
          animate={{ x: [0, 80, -40, 0], y: [0, 40, 10, 0] }} transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }} />
      )}
    </div>
  )
}

// Shared Overview grid: hero (8 cols) + terminal (4 cols), ops rail, risk + timeline.
function OverviewLayout({ hero, terminal, metrics, risk, timeline, footer }: { hero: React.ReactNode; terminal: React.ReactNode; metrics: React.ReactNode; risk: React.ReactNode; timeline: React.ReactNode; footer: string }) {
  return (<>
    <section className="relative grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="relative overflow-hidden rounded-2xl xl:col-span-8"
        style={{ minHeight: 460, background: 'linear-gradient(160deg, rgba(13,20,36,0.6), rgba(6,10,20,0.35))', border: '1px solid rgba(120,160,255,0.16)', boxShadow: '0 30px 80px -50px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03) inset' }}>
        {hero}
      </div>
      {/* intelligence terminal beside the hero. Forced height only at xl (where it
          matches the hero's height); below xl it stacks and sizes to its content. */}
      <div className="xl:col-span-4 xl:min-h-[460px]">
        {terminal}
      </div>
    </section>
    {/* Operational readouts. The Trust Score is shown ONLY in the hero core. */}
    {metrics}
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {risk}
      {timeline}
    </div>
    <p className="pt-2 text-center font-mono text-[10px]" style={{ color: C.text3 }}>{footer}</p>
  </>)
}

function HeroFrame({ title, subline, chip, children, legend }: { title: string; subline: string; chip: React.ReactNode; children: React.ReactNode; legend: React.ReactNode }) {
  return (<>
    <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.cyan, boxShadow: `0 0 8px ${C.cyan}` }} />
          <h2 className="text-xs font-semibold tracking-[0.22em]" style={{ color: C.text1 }}>{title}</h2>
        </div>
        <p className="mt-0.5 truncate font-mono text-[10px]" style={{ color: C.text3 }}>{subline}</p>
      </div>
      {chip}
    </div>
    <div className="absolute inset-0 flex items-center justify-center pt-8">{children}</div>
    <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-3 px-5 py-3 font-mono text-[10px]" style={{ color: C.text3, background: 'linear-gradient(0deg, rgba(6,10,20,0.7), transparent)' }}>
      {legend}
    </div>
  </>)
}

const Legend = ({ items }: { items: readonly (readonly [string, string])[] }) => (<>
  {items.map(([l, c]) => (
    <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
  ))}
</>)

function PreviewOverview({ locale }: { locale: string }) {
  return (
    <OverviewLayout
      hero={
        <HeroFrame title="TRUST NETWORK" subline="sample topology · illustrative preview"
          chip={<span className="rounded-md border px-2 py-1 font-mono text-[9px] tracking-widest" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text3 }}>PREVIEW</span>}
          legend={<Legend items={[['verified', '#34d399'], ['established', '#22d3ee'], ['limited', '#a78bfa'], ['caution', '#fbbf24'], ['risk', '#f87171']]} />}>
          <HeroNetwork {...SAMPLE_HERO} ariaLabel="Sample trust network (illustrative, fictional example.test domains)" />
        </HeroFrame>
      }
      terminal={<IntelTerminal rows={SAMPLE_ROWS} title="INTEL://sample.feed" badge="SAMPLE" />}
      metrics={<TrustScoreCards metrics={SAMPLE_METRICS} />}
      risk={<RiskPanel />}
      timeline={<VerificationTimeline items={SAMPLE_TIMELINE} />}
      footer={`Preview · illustrative sample data (fictional example.test domains) · verify a domain to see your live data — /${locale}/dashboard`}
    />
  )
}

function LiveOverview({ overview, locale, focus, onFocus }: { overview: CommandOverview; locale: string; focus: CommandDomain | null; onFocus: (domain: string) => void }) {
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const verified = verifiedDomains(overview)
  const short = (ms: number) => formatDate(lc, ms, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const nodes = categoryNodes(focus).map((n) => ({ id: n.id, deg: n.deg, dist: n.dist, r: n.r, color: n.covered ? '#22d3ee' : '#5d6a86' }))
  const rows = overview.timeline.slice(0, 14).map((e) => {
    const v = describeEvent(e)
    return { t: short(e.at), tag: v.tag, d: e.domain, msg: v.text, tone: toneColor(v.tone) }
  })
  const report = focus?.report ?? null
  return (
    <OverviewLayout
      hero={
        <HeroFrame title="TRUST NETWORK"
          subline={report ? `${focus?.domain} · signal categories · checked ${formatDate(lc, report.checkedAt, { year: 'numeric', month: 'short', day: 'numeric' })}` : `${focus?.domain ?? ''} · no stored verification check yet`}
          chip={verified.length > 1 ? (
            <select aria-label="Choose verified domain" value={focus?.domain} onChange={(e) => onFocus(e.target.value)}
              className="rounded-md border bg-transparent px-2 py-1 font-mono text-[10px]" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text2 }}>
              {verified.map((d) => <option key={d.domain} value={d.domain} style={{ background: '#050811' }}>{d.domain}</option>)}
            </select>
          ) : (
            <span className="rounded-md border px-2 py-1 font-mono text-[9px] tracking-widest" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text3 }}>{bandName(report?.band).toUpperCase()}</span>
          )}
          legend={<Legend items={[['category assessed', '#22d3ee'], ['not assessed', '#5d6a86']]} />}>
          <HeroNetwork score={report ? report.score : '—'} band={report ? bandName(report.band).toUpperCase() : 'NOT YET SCORED'} bandColor={bandColor(report?.band)}
            nodes={nodes} centerLabel={focus?.domain}
            ariaLabel={`${focus?.domain ?? 'Domain'}: trust score ${report?.score ?? 'not available'}, surrounded by its signal categories`} />
        </HeroFrame>
      }
      terminal={<IntelTerminal rows={rows} title="INTEL://account.timeline" badge={`${overview.timeline.length} EVENTS`} emptyText="No claims, checks or alerts recorded yet." />}
      metrics={<TrustScoreCards metrics={liveMetrics(overview).map((m) => ({ k: m.k, v: m.v, unit: m.unit, color: toneColor(m.tone) }))} />}
      risk={<LiveRiskPanel overview={overview} locale={locale} />}
      timeline={<VerificationTimeline items={overview.verifications.slice(0, 5).map((v) => ({ t: short(v.checkedAt), d: v.domain, s: `${bandName(v.band)} · score ${v.score}`, tone: bandColor(v.band) }))} />}
      footer={`Live TrustSeal data · loaded ${short(overview.generatedAt)}`}
    />
  )
}

export function CommandCenter({ locale = 'en' }: { locale?: string }) {
  const { user } = useAuth()
  const ov = useCommandOverview(user?.idToken)
  const data = ov.data
  const mode = data?.mode ?? null
  const live = mode === 'live'
  const preview = mode === 'preview'

  // Sidebar navigation: in-page section switch, deep-linkable via the URL hash
  // (e.g. /en/command#domains). No new routes; design unchanged.
  const [active, setActive] = useState<Section>('Overview')
  useEffect(() => {
    const fromHash = () => {
      const h = decodeURIComponent(window.location.hash.replace('#', '')).toLowerCase()
      const match = SECTIONS.find((s) => s.toLowerCase() === h)
      if (match) setActive(match)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])
  const go = (label: Section) => {
    setActive(label)
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${label.toLowerCase()}`)
  }

  const [query, setQuery] = useState('')
  const [focusName, setFocusName] = useState<string | null>(null)
  const focus = useMemo(() => {
    if (!data) return null
    return verifiedDomains(data).find((d) => d.domain === focusName) ?? primaryDomain(data)
  }, [data, focusName])

  const subline = !data ? `${ov.status === 'error' ? 'UNAVAILABLE' : 'LOADING'} · ${locale.toUpperCase()}`
    : live ? `TRUSTSEAL://${data.summary.verifiedDomains} verified domain${data.summary.verifiedDomains === 1 ? '' : 's'} · ${data.entitlement.plan.toUpperCase()} · ${locale.toUpperCase()}`
    : `PREVIEW · sample data · ${locale.toUpperCase()}`

  return (
    <div data-command-center data-mode={mode ?? 'loading'} className="relative min-h-screen w-full" style={{ color: C.text1, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <AnimatedBackdrop />

      <div className="relative flex min-h-screen">
        {/* ── Left navigation ── */}
        <nav className="sticky top-0 hidden h-screen w-[68px] shrink-0 flex-col items-center gap-1 border-r py-5 md:flex"
          style={{ borderColor: 'rgba(120,160,255,0.12)', background: 'rgba(7,11,21,0.55)', backdropFilter: 'blur(12px)' }}>
          {/* TrustSeal hex/seal mark */}
          <div className="mb-4 grid h-9 w-9 place-items-center" aria-label="TrustSeal">
            <svg viewBox="0 0 40 40" className="h-9 w-9">
              <defs><linearGradient id="nav-seal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
              <polygon points="20,3 34,11 34,29 20,37 6,29 6,11" fill="none" stroke="url(#nav-seal)" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.5))' }} />
              <path d="M14 20 l4 4 l8 -9" fill="none" stroke="url(#nav-seal)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {NAV.map((n) => {
            const on = active === n.label
            return (
              <button key={n.label} type="button" onClick={() => go(n.label)} title={n.label} aria-label={n.label} aria-current={on ? 'page' : undefined}
                className="group relative flex h-11 w-11 flex-col items-center justify-center rounded-xl text-lg transition-colors"
                style={{ color: on ? C.cyan : C.text3, background: on ? 'rgba(34,211,238,0.10)' : 'transparent' }}>
                {on && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full" style={{ background: C.cyan, boxShadow: `0 0 8px ${C.cyan}` }} />}
                <span aria-hidden>{n.icon}</span>
                <span className="text-[8px] tracking-wide">{n.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ── Top intelligence bar. Opaque + z-20 so scrolled content (incl.
                  the hero's internal TRUST NETWORK strip at z-10) passes cleanly
                  behind it. Wraps gracefully on mobile; subline hidden < sm. ── */}
          <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 sm:px-5"
            style={{ borderColor: 'rgba(120,160,255,0.12)', background: 'rgba(5,8,17,0.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold tracking-wide">TrustSeal Intelligence</h1>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-widest" style={{ borderColor: 'rgba(34,211,238,0.4)', color: C.cyan }}>COMMAND CENTER</span>
              </div>
              <p className="mt-0.5 hidden font-mono text-[10px] sm:block" style={{ color: C.text3 }}>{subline}</p>
            </div>
            <CommandSearchInput value={live ? query : ''} onChange={setQuery} disabled={!live}
              placeholder={live ? 'Search your domains, verdicts, alerts, timeline…' : preview ? 'Search is available once you verify a domain' : 'Loading…'} />
            <nav className="ml-auto flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 md:ml-0">
              <a href={`/${locale}`} className="text-xs font-semibold" style={{ color: C.cyan }}>← TrustSeal</a>
              <a href={`/${locale}/verify`} className="text-xs" style={{ color: C.text2 }}>Verify</a>
              <a href={`/${locale}/pricing`} className="text-xs" style={{ color: C.text2 }}>Pricing</a>
              <a href={`/${locale}/docs`} className="text-xs" style={{ color: C.text2 }}>Docs</a>
              <a href={`/${locale}/enterprise`} className="text-xs" style={{ color: C.text2 }}>Support</a>
              <span className="hidden h-5 w-px sm:block" style={{ background: 'rgba(120,160,255,0.18)' }} />
              {preview && <LiveDot label="SAMPLE" />}
              <AccountMenu locale={locale} verifiedDomain={focus?.domain ?? null} />
            </nav>
          </header>

          {/* PREVIEW notice — only when the account has no verified domain yet. */}
          {preview && (
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-[11px] sm:px-5" style={{ borderColor: 'rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.08)', color: '#fbbf24' }}>
              <span aria-hidden>⚠</span>
              <span><b>Preview · sample data.</b> The network, feed and metrics on the Overview are illustrative (fictional example.test domains) — <b>not real verifications or live activity</b>. Your domains, verifications, alerts and plan in the sidebar sections are real.</span>
              <a href={`/${locale}/dashboard`} className="ml-auto rounded-md px-2.5 py-1 text-[11px] font-semibold" style={{ background: '#fbbf24', color: '#1a1204' }}>Verify your first domain →</a>
            </div>
          )}

          {/* ── main: section switch (sidebar nav). ── */}
          <main className="flex-1 space-y-4 p-5">
            {!data && ov.status !== 'error' && (
              <p role="status" className="py-24 text-center font-mono text-xs" style={{ color: C.text3 }}>Loading your Command Center data…</p>
            )}
            {!data && ov.status === 'error' && (
              <div role="alert" className="mx-auto max-w-md py-24 text-center">
                <p className="text-sm font-semibold">Couldn’t load your Command Center data</p>
                <p className="mt-1 text-xs" style={{ color: C.text3 }}>{ov.httpStatus === 403 ? 'Your current plan does not include the Command Center.' : 'Please try again. No sample data is shown in its place.'}</p>
                <button type="button" onClick={ov.reload} className="mt-4 rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text1 }}>Try again</button>
              </div>
            )}

            {data && (<>
              {live && query.trim() && (
                <CommandSearchResults overview={data} query={query} locale={locale} onJump={(s) => { setQuery(''); go(s) }} />
              )}
              {active !== 'Overview' && (
                <h2 className="text-sm font-semibold tracking-wide" style={{ color: C.text1 }}>{active}</h2>
              )}
              {active === 'Domains' && <DomainsSection overview={data} locale={locale} />}
              {active === 'Verifications' && <VerificationsSection overview={data} locale={locale} />}
              {active === 'Risk' && <RiskSection overview={data} locale={locale} />}
              {active === 'Network' && <NetworkSection overview={data} focus={focus} />}
              {active === 'Timeline' && <TimelineSection overview={data} locale={locale} />}
              {active === 'Settings' && <SettingsSection overview={data} locale={locale} />}

              {active === 'Overview' && (live
                ? <LiveOverview overview={data} locale={locale} focus={focus} onFocus={setFocusName} />
                : <PreviewOverview locale={locale} />)}
            </>)}
          </main>
        </div>
      </div>
    </div>
  )
}
