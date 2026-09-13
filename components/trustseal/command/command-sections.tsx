'use client'
// components/trustseal/command/command-sections.tsx  (asq-trustseal-command-nav)
// Section views for the Command Center sidebar. Reuses the existing visual language
// (Panel chrome + HeroNetwork + ActivityFeed).
//
// Domains / Verifications / Risk / Settings always render the signed-in account's
// REAL data from the Command Center overview (an empty state appears only when the
// account genuinely has none). Network / Timeline show real data in LIVE mode and
// clearly-labelled fictional samples in PREVIEW mode.
import type { CommandDomain, CommandOverview } from '@/lib/trustseal/command/types'
import { bandColor, bandName, categoryLabel, categoryNodes, describeEvent, primaryDomain, signalLabel, signalStatusLabel, verifiedDomains } from '@/lib/trustseal/command/view-model'
import { formatDate } from '@/lib/trustseal/format'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'
import { Panel, ActivityFeed, SAMPLE_FEED, toneColor } from '@/components/trustseal/command/widgets'
import { HeroNetwork, SAMPLE_HERO } from '@/components/trustseal/command/hero-network'

const C = { text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee', warn: '#fbbf24', bad: '#f87171', line: 'rgba(120,160,255,0.12)' }
const SEV: Record<string, string> = { critical: C.bad, warning: C.warn, info: C.cyan }

const lcOf = (locale: string): Locale => (isLocale(locale) ? locale : DEFAULT_LOCALE)
const day = (lc: Locale, ms: number | null | undefined) => formatDate(lc, ms, { year: 'numeric', month: 'short', day: 'numeric' })
const stamp = (lc: Locale, ms: number | null | undefined) => formatDate(lc, ms, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function EmptyState({ icon, title, sub, action }: { icon: string; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl text-2xl" style={{ border: `1px solid ${C.line}`, color: C.text3 }} aria-hidden>{icon}</div>
      <p className="text-sm font-semibold" style={{ color: C.text1 }}>{title}</p>
      <p className="max-w-sm text-xs leading-relaxed" style={{ color: C.text3 }}>{sub}</p>
      {action}
    </div>
  )
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b py-2.5 text-xs" style={{ borderColor: C.line }}>
    <span style={{ color: C.text3 }}>{k}</span><span className="text-right" style={{ color: C.text2 }}>{v}</span>
  </div>
)

const Chip = ({ text, color }: { text: string; color: string }) => (
  <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: `${color}66`, color }}>{text}</span>
)

const VerifyCta = ({ locale }: { locale: string }) => (
  <a href={`/${locale}/dashboard`} className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: C.cyan, color: '#06121e' }}>Verify your first domain →</a>
)

export function DomainsSection({ overview, locale }: { overview: CommandOverview; locale: string }) {
  const lc = lcOf(locale)
  const s = overview.summary
  return (
    <Panel title="Domains" badge={<span className="font-mono text-[10px]" style={{ color: C.text3 }}>{s.verifiedDomains} verified · {s.pendingClaims} pending</span>}>
      {overview.domains.length === 0 ? (
        <EmptyState icon="◫" title="No domains yet" sub="Claim a domain and add its DNS TXT record from your dashboard to see it here with its trust score and status." action={<VerifyCta locale={locale} />} />
      ) : (
        <>
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b pb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ borderColor: C.line, color: C.text3 }}>
            <span>Domain</span><span>Trust score</span><span>Status</span>
          </div>
          <ul>
            {overview.domains.map((d) => <DomainRow key={d.domain} d={d} lc={lc} locale={locale} />)}
          </ul>
          {s.verifiedDomains === 0 && (
            <p className="pt-3 text-[11px]" style={{ color: C.text3 }}>No verified domains yet — finish DNS verification from your <a href={`/${locale}/dashboard`} style={{ color: C.cyan }}>dashboard</a>.</p>
          )}
        </>
      )}
    </Panel>
  )
}

function DomainRow({ d, lc, locale }: { d: CommandDomain; lc: Locale; locale: string }) {
  const verified = d.status === 'verified'
  return (
    <li className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b py-2.5 text-xs" style={{ borderColor: C.line }}>
      <div className="min-w-0">
        <p className="truncate font-mono" style={{ color: C.text1 }}>{d.domain}</p>
        <p className="text-[10px]" style={{ color: C.text3 }}>
          {d.method.toUpperCase()} · claimed {day(lc, d.claimedAt)}
          {d.verifiedAt ? ` · verified ${day(lc, d.verifiedAt)}` : ''}
          {d.report ? ` · checked ${day(lc, d.report.checkedAt)}` : ''}
        </p>
        {verified && (
          <p className="mt-0.5 text-[10px]">
            <a href={`/${locale}/trust/${d.domain}`} style={{ color: C.cyan }}>Public seal</a>
            {d.certificate && <> · <a href={`/${locale}/certificate/${d.domain}`} style={{ color: C.cyan }}>Certificate</a></>}
          </p>
        )}
      </div>
      <div className="text-right">
        {d.report
          ? <><span className="text-sm font-bold tabular-nums" style={{ color: C.text1 }}>{d.report.score}</span><span className="block text-[10px]" style={{ color: bandColor(d.report.band) }}>{bandName(d.report.band)}</span></>
          : <span className="text-[10px]" style={{ color: C.text3 }}>{verified ? 'Not scored yet' : '—'}</span>}
      </div>
      <Chip text={d.status} color={verified ? '#34d399' : d.status === 'pending' ? C.text2 : C.bad} />
    </li>
  )
}

export function VerificationsSection({ overview, locale }: { overview: CommandOverview; locale: string }) {
  const lc = lcOf(locale)
  const verified = verifiedDomains(overview)
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Verification History" badge={<span className="font-mono text-[10px]" style={{ color: C.text3 }}>{overview.verifications.length} checks</span>}>
        {overview.verifications.length === 0 ? (
          <EmptyState icon="✓" title="No verification checks recorded yet" sub={verified.length ? 'Checks appear here as your verified domains are re-checked.' : 'Verify a domain to start its verification history.'} />
        ) : (
          <ul>
            {overview.verifications.map((v, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b py-2 text-xs" style={{ borderColor: C.line }}>
                <span className="min-w-0 truncate font-mono" style={{ color: C.text1 }}>{v.domain}</span>
                <span className="shrink-0" style={{ color: bandColor(v.band) }}>{bandName(v.band)} · {v.score}</span>
                <span className="shrink-0 text-[10px] tabular-nums" style={{ color: C.text3 }}>{stamp(lc, v.checkedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Certificates" badge={<span className="font-mono text-[10px]" style={{ color: C.text3 }}>{overview.summary.certificatesAvailable} available</span>}>
        {verified.length === 0 ? (
          <EmptyState icon="⬡" title="No certificates available" sub="A verification certificate becomes available for each domain once its ownership is verified." action={<VerifyCta locale={locale} />} />
        ) : (
          <>
            <ul>
              {verified.map((d) => (
                <li key={d.domain} className="border-b py-2.5 text-xs" style={{ borderColor: C.line }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono" style={{ color: C.text1 }}>{d.domain}</span>
                    <a href={`/${locale}/certificate/${d.domain}`} className="shrink-0 text-[11px]" style={{ color: C.cyan }}>Open certificate →</a>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px]" style={{ color: C.text3 }}>{d.certificate?.id} · ownership verified {day(lc, d.verifiedAt)}</p>
                </li>
              ))}
            </ul>
            <p className="pt-3 text-[11px]" style={{ color: C.text3 }}>Certificates are generated on demand from your verified ownership record and its latest check.</p>
          </>
        )}
      </Panel>
    </div>
  )
}

export function RiskSection({ overview, locale }: { overview: CommandOverview; locale: string }) {
  const lc = lcOf(locale)
  const a = overview.summary.alerts
  const partial = overview.domains.filter((d) => d.report?.partial).map((d) => d.domain)
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Monitoring Alerts" badge={<span className="font-mono text-[10px]" style={{ color: C.text3 }}>{a.unread} unread · {a.total} total</span>}>
        {overview.risk.alerts.length === 0 ? (
          <EmptyState icon="⚠" title="No monitoring alerts"
            sub={overview.entitlement.monitoring ? 'When monitoring detects a change on a verified domain, the alert is recorded here.' : 'Monitoring alerts are not included in your current plan.'} />
        ) : (
          <>
            <ul>
              {overview.risk.alerts.map((al, i) => (
                <li key={i} className="border-b py-2.5 text-xs" style={{ borderColor: C.line }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0" style={{ color: C.text1 }}>{al.detail}</span>
                    <Chip text={al.severity} color={SEV[al.severity] ?? C.text2} />
                  </div>
                  <p className="mt-0.5 text-[10px]" style={{ color: C.text3 }}>
                    <span className="font-mono">{al.domain}</span> · {al.kind.replace(/_/g, ' ')} · {stamp(lc, al.createdAt)} · {al.read ? 'read' : 'unread'}
                  </p>
                </li>
              ))}
            </ul>
            <p className="pt-3 text-[11px]" style={{ color: C.text3 }}>Mark alerts as read from your <a href={`/${locale}/dashboard`} style={{ color: C.cyan }}>dashboard</a>.</p>
          </>
        )}
      </Panel>
      <Panel title="Signals Needing Attention" badge={<span className="font-mono text-[10px]" style={{ color: C.text3 }}>latest checks</span>}>
        {overview.risk.signals.length === 0 ? (
          <EmptyState icon="◎" title="Nothing flagged" sub={verifiedDomains(overview).length ? 'No failing, blocked or flagged signals in the latest checks of your verified domains.' : 'Signals appear once a verified domain has been checked.'} />
        ) : (
          <ul>
            {overview.risk.signals.map((s, i) => (
              <li key={i} className="border-b py-2.5 text-xs" style={{ borderColor: C.line }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-mono" style={{ color: C.text1 }}>{signalLabel(s.id)}</span>
                  <span className="shrink-0 text-[11px]" style={{ color: C.warn }}>{signalStatusLabel(s.status)}</span>
                </div>
                <p className="mt-0.5 text-[10px]" style={{ color: C.text3 }}><span className="font-mono">{s.domain}</span>{s.evidence ? ` · ${s.evidence}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
        {partial.length > 0 && (
          <p className="pt-3 text-[11px]" style={{ color: C.text3 }}>Latest check had partial coverage for: <span className="font-mono">{partial.join(', ')}</span>.</p>
        )}
      </Panel>
    </div>
  )
}

const LEGEND_SAMPLE = [['verified', '#34d399'], ['established', '#22d3ee'], ['limited', '#a78bfa'], ['caution', '#fbbf24'], ['risk', '#f87171']] as const

export function NetworkSection({ overview, focus }: { overview: CommandOverview; focus?: CommandDomain | null }) {
  if (overview.mode !== 'live') {
    return (
      <Panel title="Trust Network" badge={<span className="font-mono text-[9px] tracking-widest" style={{ color: C.text3 }}>PREVIEW · SAMPLE</span>}>
        <div className="relative flex items-center justify-center" style={{ minHeight: 440 }}>
          <HeroNetwork {...SAMPLE_HERO} ariaLabel="Sample trust network (illustrative, fictional example.test domains)" />
        </div>
        <div className="flex flex-wrap gap-3 pt-2 font-mono text-[10px]" style={{ color: C.text3 }}>
          {LEGEND_SAMPLE.map(([l, c]) => (
            <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
          ))}
        </div>
      </Panel>
    )
  }
  const d = focus ?? primaryDomain(overview)
  const nodes = categoryNodes(d).map((n) => ({ id: n.id, deg: n.deg, dist: n.dist, r: n.r, color: n.covered ? '#22d3ee' : '#5d6a86' }))
  return (
    <Panel title="Trust Network" badge={<span className="font-mono text-[9px] tracking-widest" style={{ color: C.text3 }}>SIGNAL CATEGORIES · LATEST CHECK</span>}>
      <div className="relative flex items-center justify-center" style={{ minHeight: 440 }}>
        <HeroNetwork score={d?.report ? d.report.score : '—'} band={d?.report ? bandName(d.report.band).toUpperCase() : 'NOT YET SCORED'}
          bandColor={bandColor(d?.report?.band)} nodes={nodes} centerLabel={d?.domain}
          ariaLabel={`${d?.domain ?? 'Domain'}: trust score ${d?.report?.score ?? 'not available'}, surrounded by its signal categories`} />
      </div>
      {d?.report ? (
        <ul className="grid grid-cols-2 gap-x-6 pt-2 sm:grid-cols-4">
          {d.report.categories.map((c) => (
            <li key={c.category} className="flex items-center justify-between border-b py-1.5 text-[11px]" style={{ borderColor: C.line }}>
              <span style={{ color: C.text3 }}>{categoryLabel(c.category)}</span>
              <span className="tabular-nums" style={{ color: c.covered ? C.text1 : C.text3 }}>{c.covered ? c.subScore : 'not assessed'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pt-2 text-xs" style={{ color: C.text3 }}>No stored verification check yet for this domain, so there are no signal categories to show.</p>
      )}
    </Panel>
  )
}

export function TimelineSection({ overview, locale }: { overview: CommandOverview; locale: string }) {
  if (overview.mode !== 'live') return <ActivityFeed items={SAMPLE_FEED} badge="SAMPLE" />
  const lc = lcOf(locale)
  return (
    <Panel title="Activity Timeline" badge={<span className="font-mono text-[10px]" style={{ color: C.text3 }}>{overview.timeline.length} events</span>}>
      {overview.timeline.length === 0 ? (
        <EmptyState icon="◷" title="No activity recorded yet" sub="Claims, verification checks and monitoring alerts appear here." />
      ) : (
        <ul className="space-y-1.5">
          {overview.timeline.map((e, i) => {
            const v = describeEvent(e)
            return (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-1.5 text-xs" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="w-36 shrink-0 text-[10px] tabular-nums" style={{ color: C.text3 }}>{stamp(lc, e.at)}</span>
                <span className="rounded px-1 font-mono text-[10px]" style={{ color: toneColor(v.tone), background: `${toneColor(v.tone)}14` }}>{v.tag}</span>
                <span className="font-mono" style={{ color: C.text1 }}>{e.domain}</span>
                <span className="min-w-0" style={{ color: C.text2 }}>{v.text}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export function SettingsSection({ overview, locale }: { overview: CommandOverview; locale: string }) {
  const lc = lcOf(locale)
  const e = overview.entitlement
  const plan = e.plan.charAt(0).toUpperCase() + e.plan.slice(1)
  const d = primaryDomain(overview)
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Plan & Access">
        <Row k="Plan" v={plan} />
        <Row k="Subscription status" v={e.status.replace(/_/g, ' ')} />
        <Row k={e.status === 'cancelled' || e.status === 'halted' ? 'Access until' : 'Current period ends'} v={day(lc, e.currentEnd)} />
        {e.inGrace && <Row k="Payment grace period" v="Active" />}
        <Row k="Domain limit" v={String(e.maxDomains)} />
        <Row k="Monitoring alerts" v={e.monitoring ? 'Included' : 'Not included'} />
        <Row k="Language" v={locale.toUpperCase()} />
        <p className="pt-3 text-[11px]" style={{ color: C.text3 }}>Plan and billing are managed from your <a href={`/${locale}/dashboard`} style={{ color: C.cyan }}>TrustSeal dashboard</a>.</p>
      </Panel>
      <Panel title="Account Actions">
        <Row k="Domains, billing, API access, monitoring" v={<a href={`/${locale}/dashboard`} style={{ color: C.cyan }}>Open dashboard →</a>} />
        <Row k="Add a domain" v={<a href={`/${locale}/dashboard`} style={{ color: C.cyan }}>Claim wizard →</a>} />
        {d && <Row k="Public seal page" v={<a href={`/${locale}/trust/${d.domain}`} style={{ color: C.cyan }}>{d.domain} →</a>} />}
        {d && <Row k="Verification certificate" v={<a href={`/${locale}/certificate/${d.domain}`} style={{ color: C.cyan }}>Open →</a>} />}
        <Row k="Plans" v={<a href={`/${locale}/pricing`} style={{ color: C.cyan }}>Pricing →</a>} />
      </Panel>
    </div>
  )
}
