/**
 * CommandRef + CommandRefTable — quick-reference card for CLI commands.
 *
 * Usage:
 *   <CommandRefTable>
 *     <CommandRef
 *       command="/status"
 *       description="Show API connection status, model, and context window size."
 *       example="> /status"
 *     />
 *     <CommandRef
 *       command="/compact"
 *       description="Summarize conversation to free context window space."
 *     />
 *   </CommandRefTable>
 */

export function CommandRef({
  command,
  description,
  example,
  flag,
}: {
  command: string
  description: string
  example?: string
  /** Optional: 'slash' | 'bash' | 'flag' — controls the badge color */
  flag?: 'slash' | 'bash' | 'flag'
}) {
  const colorMap = {
    slash: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
    bash:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
    flag:  'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  }
  const colorClass = flag ? colorMap[flag] : colorMap.slash

  return (
    <div className="flex items-start gap-4 px-4 py-3.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.015] transition-colors">
      {/* Command badge */}
      <code className={`shrink-0 text-[11px] font-mono rounded px-2 py-1 border whitespace-nowrap mt-0.5 ${colorClass}`}>
        {command}
      </code>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-300 leading-snug">{description}</p>
        {example && (
          <p className="text-[11px] font-mono text-surface-600 mt-1.5 truncate">{example}</p>
        )}
      </div>
    </div>
  )
}

export function CommandRefTable({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="my-6 rounded-xl border border-white/[0.07] overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 bg-surface-900/60 border-b border-white/[0.06]">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-surface-600">
            {title}
          </p>
        </div>
      )}
      <div className="divide-y divide-white/[0.04]">
        {children}
      </div>
    </div>
  )
}
