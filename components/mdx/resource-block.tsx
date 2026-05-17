// Resource block — links to files, templates, or external references.
// Usage in MDX:
//   <Resource
//     title="Claude Code Settings Reference"
//     description="Complete reference for all Claude Code configuration options."
//     href="https://docs.anthropic.com/..."
//     type="docs"
//   />
//   <Resource title="wp_patch_template.py" href="/downloads/wp_patch_template.py" type="download" />

type ResourceType = 'download' | 'docs' | 'reference' | 'tool' | 'template'

const TYPE_CONFIG: Record<ResourceType, { icon: React.ReactNode; label: string; classes: string }> = {
  download:  { icon: '↓', label: 'Download', classes: 'text-brand-400 bg-brand-500/10 border-brand-500/25'   },
  docs:      { icon: '◎', label: 'Docs',     classes: 'text-blue-400 bg-blue-500/10 border-blue-500/25'      },
  reference: { icon: '§',  label: 'Ref',      classes: 'text-purple-400 bg-purple-500/10 border-purple-500/25'},
  tool:      { icon: '⚙',  label: 'Tool',     classes: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25'      },
  template:  { icon: '▤',  label: 'Template', classes: 'text-green-400 bg-green-500/10 border-green-500/25'   },
}

interface ResourceBlockProps {
  title:       string
  description?: string
  href:        string
  type?:       ResourceType
}

export function Resource({ title, description, href, type = 'docs' }: ResourceBlockProps) {
  const cfg      = TYPE_CONFIG[type]
  const external = href.startsWith('http')

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="my-4 flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 hover:border-white/[0.13] hover:bg-white/[0.04] transition-all group block"
    >
      {/* Type badge */}
      <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-sm font-bold ${cfg.classes}`}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-200 group-hover:text-surface-100 transition-colors truncate">
          {title}
        </p>
        {description && (
          <p className="mt-0.5 text-xs text-surface-600 line-clamp-1">{description}</p>
        )}
      </div>

      {/* Arrow */}
      <div className="shrink-0 text-surface-700 group-hover:text-surface-400 transition-colors">
        {type === 'download' ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 3v7m0 0l-3-3m3 3l3-3M3 13h10" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 8h10m0 0l-4-4m4 4l-4 4" />
          </svg>
        )}
      </div>
    </a>
  )
}
