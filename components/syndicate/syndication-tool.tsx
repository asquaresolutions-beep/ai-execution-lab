'use client'

import { useState, useMemo } from 'react'
import type { ContentMeta } from '@/lib/content'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Platform = 'linkedin' | 'twitter' | 'newsletter'

interface SyndicationToolProps {
  items: ContentMeta[]
  siteUrl: string
}

// ─────────────────────────────────────────────────────────────
// Template generators
// ─────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  docs:          'Documentation',
  systems:       'Production System',
  labs:          'Research Lab',
  'case-studies':'Case Study',
  playbooks:     'Execution Playbook',
  failures:      'Failure Report',
}

function generateLinkedIn(item: ContentMeta, url: string): string {
  const fm      = item.frontmatter
  const section = SECTION_LABELS[item.section] ?? item.section
  const tags    = (fm.tags ?? []).slice(0, 5).map(t => `#${t.replace(/-/g, '')}`).join(' ')
  const impact  = fm.impact ? `\n📊 ${fm.impact}` : ''
  const goal    = fm.goal   ? `\n🎯 ${fm.goal}`   : ''
  const resTime = fm.resolution_time ? `\nResolution time: ${fm.resolution_time}` : ''
  const sev     = fm.severity ? `\nSeverity: ${fm.severity.toUpperCase()}` : ''

  return `${fm.title}

${fm.description}${impact}${goal}${sev}${resTime}

This is part of the AI Execution Lab — a public engineering knowledge base documenting real production work: systems built, deployments shipped, failures recovered.

Every entry is sourced from actual execution. No fabricated incidents, no synthetic case studies.

🔗 ${url}

${tags}
#AIExecution #ClaudeCode #ProductionEngineering`
}

function generateTwitter(item: ContentMeta, url: string): string {
  const fm      = item.frontmatter
  const section = SECTION_LABELS[item.section] ?? item.section
  const tags    = (fm.tags ?? []).slice(0, 3).map(t => `#${t.replace(/-/g, '')}`).join(' ')

  const lines: string[] = [
    `🧵 ${section}: ${fm.title}`,
    ``,
    fm.description,
  ]

  if (fm.impact)          lines.push(``, `Result: ${fm.impact}`)
  if (fm.goal)            lines.push(``, `Goal: ${fm.goal}`)
  if (fm.resolution_time) lines.push(``, `Resolved in: ${fm.resolution_time}`)
  if (fm.hypothesis)      lines.push(``, `Hypothesis: ${fm.hypothesis}`)

  lines.push(``, `Full write-up 👇`)
  lines.push(url)
  lines.push(``, tags)

  return lines.join('\n')
}

function generateNewsletter(item: ContentMeta, url: string): string {
  const fm      = item.frontmatter
  const section = SECTION_LABELS[item.section] ?? item.section

  const lines: string[] = [
    `**${section.toUpperCase()}**`,
    ``,
    `## ${fm.title}`,
    ``,
    fm.description,
  ]

  if (fm.impact) {
    lines.push(``, `**Impact:** ${fm.impact}`)
  }
  if (fm.goal) {
    lines.push(``, `**Goal:** ${fm.goal}`)
  }
  if (fm.hypothesis) {
    lines.push(``, `**Hypothesis:** ${fm.hypothesis}`)
  }
  if (fm.resolution_time) {
    lines.push(``, `**Resolution time:** ${fm.resolution_time}`)
  }
  if (fm.tags && fm.tags.length > 0) {
    lines.push(``, `**Tags:** ${fm.tags.join(', ')}`)
  }

  lines.push(``, `[Read the full article →](${url})`)

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; charLimit?: number }> = {
  linkedin:   { label: 'LinkedIn',   icon: 'in', charLimit: 3000 },
  twitter:    { label: 'X / Twitter', icon: 'X',  charLimit: 280 },
  newsletter: { label: 'Newsletter', icon: '✉',  charLimit: undefined },
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function SyndicationTool({ items, siteUrl }: SyndicationToolProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>(items[0]?.slug ?? '')
  const [platform,     setPlatform]     = useState<Platform>('linkedin')
  const [copied,       setCopied]       = useState(false)

  const selectedItem = useMemo(
    () => items.find(i => i.slug === selectedSlug),
    [items, selectedSlug]
  )

  const canonicalUrl = selectedItem
    ? `${siteUrl}/${selectedItem.section}/${selectedItem.slug}`
    : ''

  const generated = useMemo(() => {
    if (!selectedItem) return ''
    if (platform === 'linkedin')   return generateLinkedIn(selectedItem, canonicalUrl)
    if (platform === 'twitter')    return generateTwitter(selectedItem, canonicalUrl)
    if (platform === 'newsletter') return generateNewsletter(selectedItem, canonicalUrl)
    return ''
  }, [selectedItem, platform, canonicalUrl])

  const charCount  = generated.length
  const charLimit  = PLATFORM_CONFIG[platform].charLimit
  const overLimit  = charLimit ? charCount > charLimit : false

  async function handleCopy() {
    await navigator.clipboard.writeText(generated)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Group items by section for the select
  const sections = Array.from(new Set(items.map(i => i.section)))

  return (
    <div className="space-y-6">

      {/* Controls row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Content picker */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-surface-600 mb-1.5">
            Content item
          </label>
          <select
            value={selectedSlug}
            onChange={e => setSelectedSlug(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-surface-900/60 px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-brand-500/50 transition-colors"
          >
            {sections.map(sec => (
              <optgroup key={sec} label={SECTION_LABELS[sec] ?? sec}>
                {items
                  .filter(i => i.section === sec)
                  .map(i => (
                    <option key={i.slug} value={i.slug}>
                      {i.frontmatter.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Platform picker */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-surface-600 mb-1.5">
            Platform
          </label>
          <div className="flex gap-2">
            {(Object.keys(PLATFORM_CONFIG) as Platform[]).map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-mono transition-all ${
                  platform === p
                    ? 'border-brand-500/50 bg-brand-500/10 text-brand-300'
                    : 'border-white/[0.08] bg-white/[0.02] text-surface-500 hover:text-surface-300 hover:border-white/[0.14]'
                }`}
              >
                {PLATFORM_CONFIG[p].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected item preview */}
      {selectedItem && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-brand-400 uppercase">
              {SECTION_LABELS[selectedItem.section]}
            </span>
            {selectedItem.frontmatter.tags?.slice(0, 4).map(tag => (
              <span key={tag} className="text-[10px] text-surface-700 bg-white/[0.03] rounded px-1.5 py-0.5 border border-white/[0.05]">
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-surface-400">{selectedItem.frontmatter.description}</p>
          <p className="mt-1 text-[10px] font-mono text-surface-700">{canonicalUrl}</p>
        </div>
      )}

      {/* Generated output */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-mono uppercase tracking-widest text-surface-600">
            Generated copy
          </label>
          <div className="flex items-center gap-3">
            {charLimit && (
              <span className={`text-[10px] font-mono ${overLimit ? 'text-red-400' : 'text-surface-700'}`}>
                {charCount} / {charLimit} chars
                {overLimit && ' (over limit — trim before posting)'}
              </span>
            )}
            <button
              onClick={handleCopy}
              disabled={!generated}
              className="inline-flex items-center gap-1.5 rounded px-3 py-1 text-[11px] font-mono border border-white/[0.08] bg-white/[0.03] text-surface-400 hover:text-surface-100 hover:border-white/[0.16] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {copied ? (
                <span className="text-green-400">✓ Copied</span>
              ) : (
                'Copy all'
              )}
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={generated}
          rows={14}
          className="w-full rounded-lg border border-white/[0.08] bg-surface-900/40 px-4 py-3 text-sm text-surface-300 font-mono leading-relaxed resize-y focus:outline-none focus:border-brand-500/30 transition-colors"
        />
      </div>

      {/* Usage note */}
      <p className="text-[11px] text-surface-700 leading-relaxed">
        Generated from content frontmatter. Review and edit before publishing — these are starting templates, not final copy. The content references real executions; accuracy is your responsibility to verify before posting.
      </p>
    </div>
  )
}
