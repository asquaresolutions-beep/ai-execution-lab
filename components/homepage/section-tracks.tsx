'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { SECTION_META, ACCENT_CLASSES } from '@/lib/utils'
import type { ContentSection } from '@/lib/content'
import type { ContentMeta } from '@/lib/content'

interface SectionTrack {
  key:   ContentSection
  count: number
  items: ContentMeta[]
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

const card = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] } },
}

export function SectionTracks({ sections }: { sections: SectionTrack[] }) {
  return (
    <div className="mb-12">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-600 mb-4">
        Sections
      </h2>
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {sections.map(({ key, count, items }) => {
          const meta = SECTION_META[key]
          const ac   = ACCENT_CLASSES[meta.accent]
          return (
            <motion.div key={key} variants={card}>
              <Link
                href={meta.href}
                className="group block rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-200"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-surface-100 group-hover:text-white transition-colors">
                      {meta.title}
                    </p>
                    <p className="mt-0.5 text-xs text-surface-500 leading-snug max-w-[22ch]">
                      {meta.description.split('.')[0]}.
                    </p>
                  </div>
                  <span className={`text-xl font-bold font-mono ${ac.text} ml-3 shrink-0`}>
                    {count}
                  </span>
                </div>

                {/* Recent items preview */}
                <div className="border-t border-white/[0.05] pt-3">
                  {items.length > 0 ? (
                    <div className="space-y-1">
                      {items.map((item) => (
                        <p key={item.slug} className="text-xs text-surface-600 truncate leading-snug">
                          <span className={`mr-1 ${ac.text} opacity-60`}>›</span>
                          {item.frontmatter.title}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-surface-700 italic">No entries yet</p>
                  )}
                </div>
              </Link>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
