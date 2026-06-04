// Trust-signal badges (server component) — privacy-first, no screenshot storage,
// secure processing, AI-powered, built by A Square Solutions.
const BADGES = [
  { icon: '🔒', label: 'Privacy-first' },
  { icon: '🖼️', label: 'No screenshot storage' },
  { icon: '🛡️', label: 'Secure processing' },
  { icon: '🤖', label: 'AI-powered detection' },
  { icon: '🏢', label: 'Built by A Square Solutions' },
]

export function TrustBadges({ className = '' }: { className?: string }) {
  return (
    <ul aria-label="Trust signals" className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {BADGES.map((b) => (
        <li key={b.label} className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-xs text-zinc-300">
          <span aria-hidden>{b.icon}</span>{b.label}
        </li>
      ))}
    </ul>
  )
}
