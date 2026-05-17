// StepList — numbered checklist with brand accent circles
// Usage in MDX (takes items as prop):
//   <StepList items={[
//     'Fetch post content with context=edit',
//     'Apply string transformations',
//     'Run pre-apply checks — abort if any fail',
//     'Pass --live flag to apply changes',
//     'Re-fetch live content to verify',
//   ]} />

export function StepList({ items }: { items: string[] }) {
  return (
    <ol className="my-6 space-y-2.5 list-none pl-0">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-[11px] font-bold text-brand-400 font-mono">
            {i + 1}
          </span>
          <span className="text-sm text-surface-300 leading-relaxed pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  )
}

// Checklist variant — for verification/validation steps
// Usage: <Checklist items={['All H2s at 28px', 'No bare headings', 'Schemas intact']} />

export function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="my-6 space-y-2 list-none pl-0">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5 w-5 h-5 rounded border border-green-500/30 bg-green-500/10 flex items-center justify-center text-[10px] text-green-400 font-bold">
            ✓
          </span>
          <span className="text-sm text-surface-300 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )
}
