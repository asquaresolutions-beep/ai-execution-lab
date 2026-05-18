/**
 * components/mdx/evidence-block.tsx
 * Wrapper component for operational evidence in MDX content.
 * Provides a metadata header (type badge, date, context, quality signal)
 * around any evidence content (Gallery, BeforeAfter, TerminalBlock, etc.)
 *
 * Usage in MDX:
 *   <EvidenceBlock type="screenshot" date="2026-05-18" context="Vercel dashboard after deploy">
 *     <Gallery images={[...]} />
 *   </EvidenceBlock>
 *
 *   <EvidenceBlock type="deployment-log" quality="reconstructed" commitRef="abc123">
 *     <DeploymentLog ... />
 *   </EvidenceBlock>
 */

import React from 'react'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type EvidenceType =
  | 'screenshot'
  | 'terminal'
  | 'analytics'
  | 'deployment-log'
  | 'build-log'
  | 'debugging'
  | 'architecture'
  | 'before-after'
  | 'search-console'

type EvidenceQuality =
  | 'verified'       // Screenshot/log taken at time of incident
  | 'approximate'    // Reconstructed from memory or partial logs
  | 'reconstructed'  // Fully reconstructed after the fact

interface Props {
  type: EvidenceType
  title?: string
  date?: string
  context?: string
  commitRef?: string
  quality?: EvidenceQuality
  children?: React.ReactNode
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<EvidenceType, { label: string; badge: string; border: string }> = {
  'screenshot':     { label: 'Screenshot',      badge: 'text-brand-400 bg-brand-500/[0.08] border-brand-500/20',     border: 'border-brand-500/10'   },
  'terminal':       { label: 'Terminal',         badge: 'text-green-400 bg-green-500/[0.08] border-green-500/20',     border: 'border-green-500/10'   },
  'analytics':      { label: 'Analytics',        badge: 'text-purple-400 bg-purple-500/[0.08] border-purple-500/20', border: 'border-purple-500/10'  },
  'deployment-log': { label: 'Deployment Log',   badge: 'text-cyan-400 bg-cyan-500/[0.08] border-cyan-500/20',       border: 'border-cyan-500/10'    },
  'build-log':      { label: 'Build Log',        badge: 'text-cyan-400 bg-cyan-500/[0.08] border-cyan-500/20',       border: 'border-cyan-500/10'    },
  'debugging':      { label: 'Debugging',        badge: 'text-yellow-400 bg-yellow-500/[0.08] border-yellow-500/20', border: 'border-yellow-500/10'  },
  'architecture':   { label: 'Architecture',     badge: 'text-surface-400 bg-white/[0.04] border-white/[0.08]',      border: 'border-white/[0.06]'   },
  'before-after':   { label: 'Before / After',   badge: 'text-amber-400 bg-amber-500/[0.08] border-amber-500/20',   border: 'border-amber-500/10'   },
  'search-console': { label: 'Search Console',   badge: 'text-orange-400 bg-orange-500/[0.08] border-orange-500/20', border: 'border-orange-500/10'  },
}

const QUALITY_CONFIG: Record<EvidenceQuality, { label: string; classes: string }> = {
  verified:      { label: 'verified',      classes: 'text-green-400 bg-green-500/[0.06] border-green-500/20'    },
  approximate:   { label: 'approximate',   classes: 'text-yellow-400 bg-yellow-500/[0.06] border-yellow-500/20' },
  reconstructed: { label: 'reconstructed', classes: 'text-surface-500 bg-white/[0.03] border-white/[0.06]'      },
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function EvidenceBlock({
  type,
  title,
  date,
  context,
  commitRef,
  quality = 'verified',
  children,
}: Props) {
  const cfg     = TYPE_CONFIG[type]
  const qualCfg = QUALITY_CONFIG[quality]

  return (
    <div className={`my-6 rounded-xl border overflow-hidden ${cfg.border} bg-white/[0.01]`}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.04] flex-wrap">
        {/* Type badge */}
        <span className={`text-[10px] font-mono font-bold uppercase tracking-widest border rounded px-2 py-0.5 shrink-0 ${cfg.badge}`}>
          {cfg.label}
        </span>

        {/* Title (if provided) */}
        {title && (
          <span className="text-xs font-medium text-surface-400 flex-1 min-w-0 truncate">
            {title}
          </span>
        )}

        <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap justify-end">
          {/* Quality indicator */}
          {quality !== 'verified' && (
            <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${qualCfg.classes}`}>
              {qualCfg.label}
            </span>
          )}

          {/* Commit ref */}
          {commitRef && (
            <span className="text-[10px] font-mono text-surface-700 bg-white/[0.03] border border-white/[0.06] rounded px-1.5 py-0.5">
              {commitRef.length > 10 ? commitRef.slice(0, 8) : commitRef}
            </span>
          )}

          {/* Date */}
          {date && (
            <time className="text-[10px] font-mono text-surface-700">
              {date}
            </time>
          )}
        </div>
      </div>

      {/* Context row (optional) */}
      {context && (
        <div className="px-4 py-2 bg-white/[0.01] border-b border-white/[0.03]">
          <p className="text-[11px] text-surface-600 leading-snug">{context}</p>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
