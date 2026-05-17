// WorkflowBlock + WorkflowStep — visualize step-by-step processes
// Usage in MDX:
//   <WorkflowBlock title="Patch operation flow">
//     <WorkflowStep n={1} title="Read" desc="GET /posts/{id}?context=edit" />
//     <WorkflowStep n={2} title="Transform" desc="Apply string replacements" />
//   </WorkflowBlock>

export function WorkflowBlock({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="my-6 rounded-xl border border-surface-700/60 bg-surface-900/40 overflow-hidden">
      {title && (
        <div className="px-5 py-3 border-b border-surface-800/60 bg-surface-900/60">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-surface-500">
            {title}
          </p>
        </div>
      )}
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  )
}

export function WorkflowStep({
  n,
  title,
  desc,
  status,
}: {
  n: number
  title: string
  desc?: string
  status?: 'done' | 'active' | 'pending'
}) {
  const isLast = false // determined by CSS

  return (
    <div className="flex gap-3 group [&:last-child_.step-line]:hidden">
      {/* Number + line */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
            status === 'done'
              ? 'bg-green-500/15 border-green-500/40 text-green-400'
              : status === 'active'
              ? 'bg-brand-500/15 border-brand-500/50 text-brand-400'
              : 'bg-surface-800/60 border-surface-700/60 text-surface-400'
          }`}
        >
          {status === 'done' ? '✓' : n}
        </div>
        <div className="step-line w-px flex-1 min-h-[16px] bg-surface-800/60 mt-1 mb-0.5" />
      </div>

      {/* Content */}
      <div className="pb-5 pt-0.5 flex-1 min-w-0">
        <p className="text-sm font-semibold text-surface-200">{title}</p>
        {desc && (
          <p className="mt-0.5 text-sm text-surface-400 font-mono text-[0.8em] leading-snug">{desc}</p>
        )}
      </div>
    </div>
  )
}
