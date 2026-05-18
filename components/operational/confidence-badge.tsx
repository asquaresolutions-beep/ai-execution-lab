/**
 * components/operational/confidence-badge.tsx
 * Visual confidence score indicator for failure debugging paths.
 *
 * Score meaning:
 *   >= 80  green  — battle-tested, multiple confirmed instances
 *   60–79  yellow — single well-documented instance, reliable fix
 *   < 60   red    — limited evidence, treat fix as hypothesis
 */
import { cn } from '@/lib/utils'

interface ConfidenceBadgeProps {
  score: number
  /** Show the numeric score alongside the label */
  showScore?: boolean
  /** Compact mode — icon only, no label */
  compact?: boolean
  className?: string
}

function getConfidenceConfig(score: number) {
  if (score >= 80) return {
    label:   'High Confidence',
    short:   'High',
    color:   'text-green-400',
    bg:      'bg-green-500/10',
    border:  'border-green-500/25',
    dot:     'bg-green-400',
    bar:     'bg-green-500',
  }
  if (score >= 60) return {
    label:   'Moderate Confidence',
    short:   'Moderate',
    color:   'text-yellow-400',
    bg:      'bg-yellow-500/10',
    border:  'border-yellow-500/25',
    dot:     'bg-yellow-400',
    bar:     'bg-yellow-500',
  }
  return {
    label:   'Low Confidence',
    short:   'Low',
    color:   'text-red-400',
    bg:      'bg-red-500/10',
    border:  'border-red-500/25',
    dot:     'bg-red-400',
    bar:     'bg-red-500',
  }
}

export function ConfidenceBadge({
  score,
  showScore = true,
  compact = false,
  className,
}: ConfidenceBadgeProps) {
  const c = getConfidenceConfig(score)

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono border',
          c.color, c.bg, c.border, className
        )}
        title={`${c.label} — ${score}/100`}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.dot)} />
        {showScore ? score : c.short}
      </span>
    )
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2',
        c.bg, c.border
      )}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-semibold', c.color)}>{c.label}</span>
            {showScore && (
              <span className={cn('text-[10px] font-mono', c.color)}>{score}/100</span>
            )}
          </div>
          {/* Score bar */}
          <div className="w-24 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', c.bar)}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline compact version for use in lists and cards
 */
export function ConfidenceChip({
  score,
  className,
}: {
  score: number
  className?: string
}) {
  return <ConfidenceBadge score={score} compact showScore className={className} />
}
