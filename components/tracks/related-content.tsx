import Link from 'next/link'
import { getRelatedContent, type RelatedItem } from '@/lib/related-content'

// ─────────────────────────────────────────────────────────────
// Type badges
// ─────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<RelatedItem['type'], { label: string; classes: string }> = {
  lesson:      { label: 'Lesson',      classes: 'text-surface-500 border-surface-700/50'  },
  playbook:    { label: 'Playbook',    classes: 'text-amber-500/80 border-amber-500/20'   },
  failure:     { label: 'Failure',     classes: 'text-red-400/80 border-red-500/20'       },
  log:         { label: 'Log',         classes: 'text-cyan-400/70 border-cyan-500/20'     },
  'case-study':{ label: 'Case Study',  classes: 'text-purple-400/70 border-purple-500/20' },
  doc:         { label: 'Doc',         classes: 'text-surface-500 border-surface-700/50'  },
  track:       { label: 'Track',       classes: 'text-brand-400/80 border-brand-500/20'   },
  lab:         { label: 'Lab',         classes: 'text-green-400/70 border-green-500/20'   },
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

interface Props {
  lessonId: string
  trackId:  string
}

export function RelatedContent({ lessonId, trackId }: Props) {
  const items = getRelatedContent(lessonId, trackId)
  if (items.length === 0) return null

  return (
    <div className="mt-10 pt-8 border-t border-white/[0.06]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-700 mb-4">
        Related reading
      </p>

      <div className="space-y-2">
        {items.map((item) => {
          const style = TYPE_STYLES[item.type]
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3 rounded-lg border border-white/[0.05] px-3 py-2.5 hover:bg-white/[0.03] hover:border-white/[0.09] transition-all group"
            >
              <span className={`shrink-0 mt-0.5 text-[9px] font-mono font-bold uppercase tracking-widest border rounded px-1.5 py-0.5 ${style.classes}`}>
                {style.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-surface-300 group-hover:text-surface-100 transition-colors leading-snug">
                  {item.label}
                </p>
                {item.note && (
                  <p className="text-[11px] text-surface-600 mt-0.5 leading-snug">{item.note}</p>
                )}
              </div>
              <span className="shrink-0 text-[11px] text-surface-700 group-hover:text-surface-500 transition-colors mt-0.5">→</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
