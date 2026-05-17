import type { Metadata } from 'next'
import { getAllMeta, type ContentSection } from '@/lib/content'
import { SyndicationTool } from '@/components/syndicate/syndication-tool'

export const metadata: Metadata = {
  title: 'Syndication',
  description: 'Generate platform-ready copy from published content. Turn executions into LinkedIn posts, X threads, and newsletter summaries.',
  robots: { index: false, follow: false },
}

const SECTIONS: ContentSection[] = ['failures', 'case-studies', 'labs', 'systems', 'playbooks', 'docs']

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ai-execution-lab.vercel.app'

export default function SyndicatePage() {
  const items = SECTIONS.flatMap((s) => getAllMeta(s))

  return (
    <div className="px-6 lg:px-8 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest rounded px-2 py-1 border text-brand-400 bg-brand-500/10 border-brand-500/25">
            PUBLISH
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-surface-50">
          Content Syndication
        </h1>
        <p className="mt-2 text-sm text-surface-400 leading-relaxed max-w-2xl">
          Generate platform-ready post copy from any published content item. Failures become incident reports,
          case studies become execution highlights, labs become research threads.
        </p>
        <p className="mt-2 text-xs font-mono text-surface-600">
          Templates are starting points. Edit before posting.
        </p>
      </div>

      {/* Tool */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] border-dashed p-12 text-center">
          <p className="text-surface-600 text-sm">No published content yet.</p>
        </div>
      ) : (
        <SyndicationTool items={items} siteUrl={SITE_URL} />
      )}
    </div>
  )
}
