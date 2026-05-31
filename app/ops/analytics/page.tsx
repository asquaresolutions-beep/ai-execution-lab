import type { Metadata } from 'next'
import { analyticsSnapshot } from '@/lib/analytics'
import { listDeadLetters } from '@/lib/distribution/dlq'
import { recentErrors } from '@/lib/observability/errors'
import { validateProductionEnv } from '@/lib/env'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Production Analytics — Command Center',
  description: 'Queue health, publishing metrics, AI usage, ingestion stats, dead-letter queue, errors.',
  robots: { index: false, follow: false },
}

const HEALTH: Record<string, string> = {
  healthy: 'text-green-400 bg-green-500/10 border-green-500/25',
  degraded: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
  unhealthy: 'text-red-400 bg-red-500/10 border-red-500/25',
}

export default async function AnalyticsOps() {
  const [snap, dlq, errors] = await Promise.all([
    analyticsSnapshot(), listDeadLetters(20), recentErrors(20),
  ])
  const envr = validateProductionEnv()

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Production Analytics</h1>
        <p className="text-sm text-neutral-400">
          AI <span className={envr.aiLive ? 'text-green-400' : 'text-yellow-400'}>{envr.aiLive ? 'live' : 'mock'}</span>
          {' · '}persistence <span className={envr.persistence === 'firestore' ? 'text-green-400' : 'text-yellow-400'}>{envr.persistence}</span>
          {' · '}env <span className={envr.ok ? 'text-green-400' : 'text-red-400'}>{envr.ok ? 'valid' : `missing ${envr.missingRequired.length}`}</span>
        </p>
      </header>

      {/* Queue health */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">Queue health</h2>
          <span className={cn('rounded border px-2 py-0.5 text-xs font-medium', HEALTH[snap.queue.status])}>{snap.queue.status}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Stat label="queued" value={snap.queue.queued} />
          <Stat label="processing" value={snap.queue.processing} />
          <Stat label="published" value={snap.queue.published} />
          <Stat label="failed" value={snap.queue.failed} tone={snap.queue.failed > 0 ? 'warn' : undefined} />
          <Stat label="dead-letter" value={snap.queue.dlq} tone={snap.queue.dlq > 0 ? 'bad' : undefined} />
          <Stat label="fail rate" value={`${(snap.queue.failureRate * 100).toFixed(0)}%`} />
        </div>
        {snap.queue.issues.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-yellow-400">
            {snap.queue.issues.map((i, k) => <li key={k}>⚠ {i}</li>)}
          </ul>
        )}
      </section>

      {/* Cost + quota */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
          AI cost today · ${snap.cost.todayUsd.toFixed(4)}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(snap.cost.byTier).map(([tier, usd]) => (
            <Stat key={tier} label={`${tier} $`} value={`$${usd.toFixed(4)}`} />
          ))}
          {snap.quota.map((q) => (
            <Stat key={q.tier} label={`${q.tier} quota/min`} value={`${(q.utilization * 100).toFixed(0)}%`} tone={q.nearLimit ? 'warn' : undefined} />
          ))}
        </div>
      </section>

      {/* Publishing + AI */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Publishing metrics · {(snap.publishing.overallSuccessRate * 100).toFixed(0)}% success
          </h2>
          {Object.keys(snap.publishing.byChannel).length === 0 ? <Empty msg="No jobs yet." /> : (
            <div className="space-y-1.5">
              {Object.entries(snap.publishing.byChannel).map(([ch, m]) => (
                <div key={ch} className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm">
                  <span className="text-neutral-300">{ch}</span>
                  <span className="flex items-center gap-3 text-xs text-neutral-400">
                    <span className="text-green-400">{m.published}✓</span>
                    {m.failed > 0 && <span className="text-red-400">{m.failed}✗</span>}
                    {m.queued > 0 && <span className="text-yellow-400">{m.queued}⏳</span>}
                    <span className="font-mono">{(m.successRate * 100).toFixed(0)}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">AI usage</h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="generations" value={snap.ai.generations} />
            <Stat label="cache hits" value={snap.ai.cacheHits} />
            <Stat label="cache hit rate" value={`${(snap.ai.cacheHitRate * 100).toFixed(0)}%`} tone="good" />
            <Stat label="ai errors" value={snap.ai.errors} tone={snap.ai.errors > 0 ? 'warn' : undefined} />
          </div>
        </section>
      </div>

      {/* Ingestion */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
          Ingestion · {snap.ingestion.total} reports · {(snap.ingestion.dedupRate * 100).toFixed(0)}% dedup
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(snap.ingestion.byCategory).map(([c, n]) => (
            <span key={c} className="rounded bg-neutral-800 px-2 py-1 text-neutral-300">{c} <span className="text-neutral-500">{n}</span></span>
          ))}
        </div>
      </section>

      {/* DLQ */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">Dead-letter queue ({dlq.length})</h2>
        {dlq.length === 0 ? <Empty msg="Empty — no exhausted jobs." /> : (
          <div className="space-y-1.5">
            {dlq.map((d) => (
              <div key={d.id} className="rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm">
                <div className="flex justify-between"><span className="text-neutral-300">{d.channel} · {d.locale}</span><span className="text-xs text-neutral-500">{d.attempts} attempts</span></div>
                <div className="mt-1 truncate text-xs text-red-400">{d.lastError}</div>
                <div className="mt-1 text-[11px] text-neutral-600">Replay: POST /api/distribution/dlq {`{action:"replay",dlqId:"${d.id}"}`}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Errors */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">Recent errors ({errors.length})</h2>
        {errors.length === 0 ? <Empty msg="No errors reported." /> : (
          <div className="space-y-1 font-mono text-xs">
            {errors.map((e, i) => (
              <div key={i} className="flex gap-3 text-neutral-400">
                <span className="text-neutral-600">{new Date(e.ts).toISOString().slice(11, 19)}</span>
                <span className={e.severity === 'critical' ? 'text-red-500' : e.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>{e.scope}</span>
                <span className="truncate">{e.message}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good' ? 'text-green-400' : tone === 'warn' ? 'text-yellow-400' : tone === 'bad' ? 'text-red-400' : 'text-white'
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
      <div className={cn('text-xl font-semibold', color)}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  )
}
function Empty({ msg }: { msg: string }) {
  return <p className="rounded-lg border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">{msg}</p>
}
