// Milestone — marks a project-level deliverable inside a lesson or project.
// Usage in MDX:
//   <Milestone n={1} title="Working dev environment">
//     You have Claude Code installed, CLAUDE.md written, and have run a real
//     agentic task in your project. Everything after this point builds on it.
//   </Milestone>

export function Milestone({
  n,
  title,
  children,
}: {
  n?:       number
  title:    string
  children?: React.ReactNode
}) {
  return (
    <div className="my-8 flex gap-4">
      {/* Number column */}
      <div className="flex flex-col items-center shrink-0">
        <div className="w-9 h-9 rounded-full bg-brand-500/15 border border-brand-500/40 flex items-center justify-center text-sm font-bold text-brand-400 font-mono">
          {n ?? '◆'}
        </div>
        {children && (
          <div className="w-px flex-1 min-h-[12px] bg-brand-500/15 mt-2" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-2 pt-1.5 min-w-0">
        <p className="text-[10px] font-mono font-bold text-brand-400 uppercase tracking-widest mb-1">
          Milestone {n}
        </p>
        <h4 className="text-base font-semibold text-surface-100 mb-2">{title}</h4>
        {children && (
          <div className="text-sm text-surface-400 leading-relaxed">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
