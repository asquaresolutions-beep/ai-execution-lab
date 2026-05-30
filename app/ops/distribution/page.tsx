import type { Metadata } from 'next'
import { listBundles } from '@/lib/distribution/engine'
import { listJobs } from '@/lib/distribution/queue'
import { channelReadiness } from '@/lib/distribution/integrations'
import { recentAudit } from '@/lib/ai/audit'
import { getProvider } from '@/lib/ai/provider'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Content Distribution — Command Center',
  description: 'AI content distribution engine: bundles, publishing queue, channel readiness.',
  robots: { index: false, follow: false },
}

const SEV: Record<string, string> = {
  low: 'text-blue-400', medium: 'text-yellow-400', high: 'text-orange-400', critical: 'text-red-400',
}
const JOB: Record<string, string> = {
  queued: 'text-yellow-400 bg-yellow-500/10', processing: 'text-blue-400 bg-blue-500/10',
  published: 'text-green-400 bg-green-500/10', failed: 'text-red-400 bg-red-500/10',
}

export default async function DistributionOps() {
  const [bundles, jobs, audit] = await Promise.all([
    listBundles(25), listJobs(undefined, 25), recentAudit(20),
  ])
  const readiness = channelReadiness()
  const provider = getProvider()

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Content Distribution Engine</h1>
        <p className="text-sm text-neutral-400">
          Provider: <span className="font-mono text-neutral-200">{provider.name}</span>
          {' · '}
          <span className={provider.live ? 'text-green-400' : 'text-yellow-400'}>
            {provider.live ? 'live AI' : 'mock mode (set GEMINI_API_KEY)'}
          </span>
        </p>
      </header>

      {/* Channel readiness */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">Channel readiness</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(readiness).map(([ch, ready]) => (
            <div key={ch} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
              <div className="text-xs text-neutral-400">{ch}</div>
              <div className={cn('mt-1 text-sm font-medium', ready ? 'text-green-400' : 'text-neutral-500')}>
                {ready ? 'ready' : 'stub'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bundles */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">Recent bundles ({bundles.length})</h2>
        {bundles.length === 0 ? (
          <Empty msg="No bundles yet. POST /api/distribution/generate to create one." />
        ) : (
          <div className="space-y-2">
            {bundles.map((b) => (
              <div key={b.id} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">{b.input.title}</span>
                  <span className={cn('text-xs font-medium', SEV[b.input.severity])}>{b.input.severity}</span>
                </div>
                <div className="mt-1 text-xs text-neutral-400">
                  {b.input.platform} · {b.input.region} · {Object.keys(b.locales).join('/')} · {b.live ? 'live' : 'mock'}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {(['markdown', 'html', 'json'] as const).map((f) => (
                    <code key={f} className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-300">
                      /api/distribution/export?id={b.id}&format={f}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Queue */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">Publishing queue ({jobs.length})</h2>
        {jobs.length === 0 ? <Empty msg="Queue empty." /> : (
          <div className="space-y-1.5">
            {jobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm">
                <span className="text-neutral-300">{j.channel} · {j.locale}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500">attempts {j.attempts}/{j.maxAttempts}</span>
                  <span className={cn('rounded px-2 py-0.5 text-xs font-medium', JOB[j.status])}>{j.status}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <AuditList audit={audit} />
    </main>
  )
}

function Empty({ msg }: { msg: string }) {
  return <p className="rounded-lg border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">{msg}</p>
}

function AuditList({ audit }: { audit: Awaited<ReturnType<typeof recentAudit>> }) {
  return (
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
  )
}
