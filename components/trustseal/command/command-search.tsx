'use client'
// components/trustseal/command/command-search.tsx
// Client-side search over the Command Center data ALREADY loaded for the signed-in
// account (view-model.searchOverview). No request is made: no verification, no
// scan, no store access, no other accounts' data. Enter does nothing destructive.
import type { CommandOverview } from '@/lib/trustseal/command/types'
import { bandName, describeEvent, searchOverview, signalLabel, signalStatusLabel } from '@/lib/trustseal/command/view-model'
import { formatDate } from '@/lib/trustseal/format'
import { isLocale, DEFAULT_LOCALE } from '@/lib/trustseal/locales'
import { Panel } from '@/components/trustseal/command/widgets'

const C = { text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee', line: 'rgba(120,160,255,0.12)' }

export function CommandSearchInput({ value, onChange, disabled, placeholder }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder: string }) {
  return (
    <div className="relative ml-auto hidden max-w-sm flex-1 items-center md:flex">
      <span className="pointer-events-none absolute left-3 text-xs" style={{ color: C.text3 }}>⌕</span>
      <input type="search" value={value} disabled={disabled} placeholder={placeholder} aria-label="Search your Command Center data"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); if (e.key === 'Escape') onChange('') }}
        className="w-full rounded-lg border bg-transparent py-2 pl-8 pr-8 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-60"
        style={{ borderColor: 'rgba(120,160,255,0.16)', color: C.text2 }} />
      {value && !disabled && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search"
          className="absolute right-2 rounded px-1.5 text-xs" style={{ color: C.text3 }}>✕</button>
      )}
    </div>
  )
}

type Section = 'Domains' | 'Verifications' | 'Risk' | 'Timeline'

export function CommandSearchResults({ overview, query, locale, onJump }: { overview: CommandOverview; query: string; locale: string; onJump: (s: Section) => void }) {
  const lc = isLocale(locale) ? locale : DEFAULT_LOCALE
  const r = searchOverview(overview, query)
  const date = (ms: number) => formatDate(lc, ms, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const Group = ({ title, section, children, n }: { title: string; section: Section; children: React.ReactNode; n: number }) => n === 0 ? null : (
    <div className="border-t pt-2" style={{ borderColor: C.line }}>
      <div className="mb-1 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: C.text3 }}>{title} · {n}</p>
        <button type="button" onClick={() => onJump(section)} className="text-[11px]" style={{ color: C.cyan }}>Open {section} →</button>
      </div>
      <ul className="space-y-1 text-xs">{children}</ul>
    </div>
  )
  return (
    <Panel title="Search results" badge={<span className="font-mono text-[10px]" style={{ color: C.text3 }}>{r.total} match{r.total === 1 ? '' : 'es'}</span>}>
      {r.total === 0 && <p className="text-xs" style={{ color: C.text2 }}>No matches in your domains, verifications, alerts, signals or timeline.</p>}
      <div className="space-y-2">
        <Group title="Domains" section="Domains" n={r.domains.length}>
          {r.domains.map((d) => <li key={d.domain} style={{ color: C.text1 }}>{d.domain} <span style={{ color: C.text3 }}>· {d.status}{d.report ? ` · ${bandName(d.report.band)} ${d.report.score}` : ''}</span></li>)}
        </Group>
        <Group title="Verification checks" section="Verifications" n={r.verifications.length}>
          {r.verifications.map((v, i) => <li key={i} style={{ color: C.text1 }}>{v.domain} <span style={{ color: C.text3 }}>· {bandName(v.band)} {v.score} · {date(v.checkedAt)}</span></li>)}
        </Group>
        <Group title="Alerts" section="Risk" n={r.alerts.length}>
          {r.alerts.map((a, i) => <li key={i} style={{ color: C.text1 }}>{a.detail} <span style={{ color: C.text3 }}>· {a.domain} · {a.severity} · {date(a.createdAt)}</span></li>)}
        </Group>
        <Group title="Signals" section="Risk" n={r.signals.length}>
          {r.signals.map((s, i) => <li key={i} style={{ color: C.text1 }}>{signalLabel(s.id)} <span style={{ color: C.text3 }}>· {signalStatusLabel(s.status)} · {s.domain}</span></li>)}
        </Group>
        <Group title="Timeline" section="Timeline" n={r.timeline.length}>
          {r.timeline.map((e, i) => { const d = describeEvent(e); return <li key={i} style={{ color: C.text1 }}>{d.text} <span style={{ color: C.text3 }}>· {e.domain} · {date(e.at)}</span></li> })}
        </Group>
      </div>
    </Panel>
  )
}
