/**
 * DeploymentLog — styled deployment log output with level-based coloring.
 * Mimics Vercel/CI build log format.
 *
 * Usage:
 *   <DeploymentLog title="Vercel Build — b70733c" entries={[
 *     { level: 'step',    message: 'Cloning repository...' },
 *     { level: 'success', message: 'Compiled successfully in 9.2s' },
 *     { level: 'step',    message: 'Generating static pages (0/99)' },
 *     { level: 'error',   message: 'Module not found: Can\'t resolve \'fs\'' },
 *     { level: 'info',    message: 'Exit code 1' },
 *   ]} />
 */

import { cn } from '@/lib/utils'

type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'step' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp?: string
}

const LEVEL_CONFIG: Record<LogLevel, { tag: string; tagClass: string; msgClass: string }> = {
  info:    { tag: 'INFO ',   tagClass: 'text-surface-600',   msgClass: 'text-surface-400' },
  debug:   { tag: 'DEBUG',   tagClass: 'text-surface-700',   msgClass: 'text-surface-600' },
  warn:    { tag: 'WARN ',   tagClass: 'text-yellow-500',    msgClass: 'text-yellow-400/80' },
  error:   { tag: 'ERROR',   tagClass: 'text-red-500',       msgClass: 'text-red-400' },
  success: { tag: '  OK  ',  tagClass: 'text-green-500',     msgClass: 'text-green-400/80' },
  step:    { tag: '  ▶  ',   tagClass: 'text-brand-500',     msgClass: 'text-surface-300' },
}

interface DeploymentLogProps {
  title?: string
  entries: LogEntry[]
  /** Highlight the result — 'success' | 'failure' */
  result?: 'success' | 'failure'
}

export function DeploymentLog({ title = 'Build Log', entries, result }: DeploymentLogProps) {
  return (
    <div className="my-6 rounded-xl overflow-hidden border border-surface-700/50 shadow-2xl shadow-black/40">
      {/* Chrome */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]',
        result === 'failure' ? 'bg-red-950/40' : result === 'success' ? 'bg-green-950/30' : 'bg-[#1c1c1e]'
      )}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] font-mono text-surface-600 ml-2">{title}</span>
        </div>
        {result && (
          <span className={cn(
            'text-[10px] font-mono rounded px-1.5 py-0.5 border',
            result === 'success'
              ? 'text-green-400 bg-green-500/10 border-green-500/25'
              : 'text-red-400 bg-red-500/10 border-red-500/25'
          )}>
            {result === 'success' ? '✓ Deployed' : '✕ Failed'}
          </span>
        )}
      </div>

      {/* Log body */}
      <div className="bg-[#0d1117] px-4 py-3 font-mono text-xs leading-relaxed overflow-x-auto space-y-0.5 max-h-80 overflow-y-auto">
        {entries.map((entry, i) => {
          const config = LEVEL_CONFIG[entry.level]
          return (
            <div key={i} className="flex items-start gap-2">
              {entry.timestamp && (
                <span className="text-surface-700 shrink-0">{entry.timestamp}</span>
              )}
              <span className={cn('shrink-0 select-none font-bold', config.tagClass)}>
                [{config.tag}]
              </span>
              <span className={config.msgClass}>{entry.message}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
