'use client'

// Compact credits dashboard — shows the user's remaining daily scans (server
// truth via /api/credits), tier, and reset time. Updates after each scan.
import { useCredits } from '@/hooks/use-credits'

export function CreditsDashboard() {
  const { remaining, quota, loggedIn, resetsAt } = useCredits()
  const reset = resetsAt ? new Date(resetsAt) : null
  const pct = quota > 0 ? Math.round((remaining / quota) * 100) : 0
  const low = remaining <= 1
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-right">
      <div className={`text-sm font-semibold ${low ? 'text-amber-300' : 'text-zinc-100'}`}>{remaining}<span className="text-zinc-500">/{quota}</span> scans left</div>
      <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full ${low ? 'bg-amber-400' : 'bg-sky-400'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-zinc-500">{loggedIn ? 'Member · 50/day' : 'Guest · 3/day'}{reset ? ` · resets ${reset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
    </div>
  )
}
