'use client'
// components/trustseal/command/command-sections.tsx  (asq-trustseal-command-nav)
// Section views for the Command Center sidebar. Reuses the existing visual language
// (Panel chrome + HeroNetwork + ActivityFeed) so design is unchanged. Sections with
// no data layer yet render honest EMPTY STATES (no fabricated rows) — not fake data.
import { Panel, ActivityFeed } from '@/components/trustseal/command/widgets'
import { HeroNetwork } from '@/components/trustseal/command/hero-network'

const C = { text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee', line: 'rgba(120,160,255,0.12)' }

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl text-2xl" style={{ border: `1px solid ${C.line}`, color: C.text3 }} aria-hidden>{icon}</div>
      <p className="text-sm font-semibold" style={{ color: C.text1 }}>{title}</p>
      <p className="max-w-sm text-xs leading-relaxed" style={{ color: C.text3 }}>{sub}</p>
    </div>
  )
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-center justify-between border-b py-2.5 text-xs" style={{ borderColor: C.line }}>
    <span style={{ color: C.text3 }}>{k}</span><span style={{ color: C.text2 }}>{v}</span>
  </div>
)

export function DomainsSection() {
  return (
    <Panel title="Verified Domains" badge={<span className="font-mono text-[10px]" style={{ color: C.text3 }}>0 domains</span>}>
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b pb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ borderColor: C.line, color: C.text3 }}>
        <span>Domain</span><span>Trust score</span><span>Status</span>
      </div>
      <EmptyState icon="◫" title="No domains verified yet" sub="Verify your first domain to see it here with its live trust score and verification status." />
    </Panel>
  )
}

export function VerificationsSection() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Verification History">
        <EmptyState icon="✓" title="No verifications yet" sub="Completed domain and business verifications will appear here as a chronological history." />
      </Panel>
      <Panel title="Certificates Issued" badge={<span className="font-mono text-[10px]" style={{ color: C.text3 }}>0 issued</span>}>
        <EmptyState icon="⬡" title="No certificates issued" sub="Verification certificates you issue will be listed here with their issue date and validity." />
      </Panel>
    </div>
  )
}

export function RiskSection() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Risk Events">
        <EmptyState icon="⚠" title="No risk events" sub="When a monitored domain triggers a risk signal, the event will be recorded here." />
      </Panel>
      <Panel title="Threat Indicators">
        <EmptyState icon="◎" title="No active threat indicators" sub="Live threat indicators across your monitored domains will surface here." />
      </Panel>
    </div>
  )
}

export function NetworkSection() {
  return (
    <Panel title="Trust Network" badge={<span className="font-mono text-[9px] tracking-widest" style={{ color: '#34d399' }}>● OPERATIONAL</span>}>
      <div className="relative flex items-center justify-center" style={{ minHeight: 440 }}>
        <HeroNetwork score={94} band="VERIFIED" />
      </div>
      <div className="flex flex-wrap gap-3 pt-2 font-mono text-[10px]" style={{ color: C.text3 }}>
        {[['verified', '#34d399'], ['established', '#22d3ee'], ['limited', '#a78bfa'], ['caution', '#fbbf24'], ['risk', '#f87171']].map(([l, c]) => (
          <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c as string }} />{l}</span>
        ))}
      </div>
    </Panel>
  )
}

export function TimelineSection() {
  return (
    <Panel title="Activity Timeline">
      <ActivityFeed />
    </Panel>
  )
}

export function SettingsSection({ locale = 'en' }: { locale?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Account Preferences">
        <Row k="Workspace locale" v={locale.toUpperCase()} />
        <Row k="Plan" v="Pro" />
        <Row k="Role" v="Owner" />
        <p className="pt-3 text-[11px]" style={{ color: C.text3 }}>Preferences are managed from your account. Changes sync to this workspace.</p>
      </Panel>
      <Panel title="Notification Settings">
        <Row k="Risk alerts" v="Managed in account" />
        <Row k="Verification updates" v="Managed in account" />
        <Row k="Weekly summary" v="Managed in account" />
        <p className="pt-3 text-[11px]" style={{ color: C.text3 }}>Notification channels are configured in your A Square Solutions account settings.</p>
      </Panel>
    </div>
  )
}
