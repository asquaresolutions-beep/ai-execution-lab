'use client'

// Circular SVG progress ring — used on track cards and the lesson sidebar.

interface ProgressRingProps {
  pct:        number   // 0–100
  size?:      number   // svg diameter in px
  stroke?:    number   // stroke width
  color?:     string   // Tailwind color class or hex (defaults to brand)
  showLabel?: boolean
  className?: string
}

export function ProgressRing({
  pct,
  size     = 36,
  stroke   = 3,
  color    = '#f97316',
  showLabel = false,
  className = '',
}: ProgressRingProps) {
  const r          = (size - stroke * 2) / 2
  const circumference = 2 * Math.PI * r
  const offset     = circumference - (pct / 100) * circumference

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-[10px] font-mono font-bold" style={{ color }}>
          {pct}
        </span>
      )}
    </div>
  )
}
