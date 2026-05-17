/**
 * LessonObjectives — "What you'll build" section at the top of lessons.
 * Usage:
 *   <LessonObjectives items={["Build X", "Configure Y", "Understand Z"]} />
 */
export function LessonObjectives({ items }: { items: string[] }) {
  return (
    <div className="my-7 rounded-xl border border-brand-500/20 bg-brand-500/5 px-6 py-5">
      <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-brand-400 mb-4">
        ⬡ What you&apos;ll build
      </p>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="text-brand-500 shrink-0 mt-[2px] font-mono text-sm">→</span>
            <span className="text-sm text-surface-300 leading-snug">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
