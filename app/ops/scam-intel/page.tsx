import type { Metadata } from 'next'
import { moderationQueue, queueSummary, trending, heatmap } from '@/lib/scam-intel/feed'
import { recentAudit } from '@/lib/ai/audit'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Scam Intelligence — Moderation Center',
  description: 'Ingestion pipeline: moderation queue, trending scams, regional heatmap.',
  robots: { index: false, follow: false },
}

const SEV: Record<string, string> = {
  low: 'text-blue-400 bg-blue-500/10', medium: 'text-yellow-400 bg-yellow-500/10',
  high: 'text-orange-400 bg-orange-500/10', critical: 'text-red-400 bg-red-500/10',
}

export default async function ScamIntelOps() {
  const [queue, summary, trend, heat, audit] = await Promise.all([
    moderationQueue('pending', 30), queueSummary(), trending(12), heatmap(30), recentAudit(20),
  ])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Scam Intelligence</h1>
        <p className="text-sm text-neutral-400">Ingestion · classification · dedup · moderation · public feed</p>
      </header>

      {/* Summary counters */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(['pending', 'approved', 'rejected', 'duplicate', 'spam'] as const).map((k) => (
          <div key={k} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="text-2xl font-semibold text-white">{summary[k] ?? 0}</div>
            <div className="text-xs uppercase tracking-wide text-neutral-400">{k}</div>
          </div>
        ))}
      </section>

      {/* Moderation queue */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">Moderation queue ({queue.length})</h2>
        {queue.length === 0 ? <Empty msg="No reports awaiting review." /> : (
          <div className="space-y-2">
            {queue.map((r) => (
              <div key={r.id} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-neutral-200">{r.classification.summary}</span>
                  <span className={cn('rounded px-2 py-0.5 text-xs font-medium', SEV[r.severity.severity])}>
                    {r.severity.severity} · {r.severity.score}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{r.text}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-400">
                  <Tag>{r.category}</Tag><Tag>{r.platform}</Tag><Tag>{r.region}</Tag>
                  <Tag>conf {(r.classification.confidence * 100) | 0}%</Tag>
                  {r.moderation.containsPII && <Tag tone="warn">PII</Tag>}
                </div>
                <div className="mt-2 text-[11px] text-neutral-600">
                  Approve: POST /api/scam-intel/moderate {`{reportId:"${r.id}",decision:"approved"}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Trending + heatmap */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">Trending patterns</h2>
          {trend.length === 0 ? <Empty msg="No trends yet." /> : (
            <div className="space-y-1.5">
              {trend.map((t) => (
                <div key={t.clusterId} className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm">
                  <span className="truncate text-neutral-300">{t.title}</span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-neutral-500">×{t.reportCount}</span>
                    <span className={cn('rounded px-1.5 py-0.5', SEV[t.severity])}>{t.severity}</span>
                    <span className="font-mono text-neutral-400">{t.trendScore}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">Regional heatmap</h2>
          {heat.length === 0 ? <Empty msg="No data." /> : (
            <div className="space-y-1.5">
              {heat.slice(0, 12).map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm">
                  <span className="text-neutral-300">{c.region} · <span className="text-neutral-500">{c.category}</span></span>
                  <span className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>×{c.count}</span>
                    <span className="h-1.5 rounded bg-red-500/60" style={{ width: Math.min(80, c.severityWeighted * 6) }} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">Audit log</h2>
        <div className="space-y-1 font-mono text-xs">
          {audit.length === 0 ? <Empty msg="No audit entries." /> : audit.map((a, i) => (
            <div key={i} className="flex gap-3 text-neutral-400">
              <span className="text-neutral-600">{new Date(a.ts).toISOString().slice(11, 19)}</span>
              <span className={a.ok ? 'text-neutral-300' : 'text-red-400'}>{a.action}</span>
              <span className="truncate">{a.message || a.subject || ''}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function Empty({ msg }: { msg: string }) {
  return <p className="rounded-lg border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">{msg}</p>
}
function Tag({ children, tone }: { children: React.ReactNode; tone?: 'warn' }) {
  return <span className={cn('rounded px-1.5 py-0.5', tone === 'warn' ? 'bg-orange-500/15 text-orange-300' : 'bg-neutral-800 text-neutral-300')}>{children}</span>
}
