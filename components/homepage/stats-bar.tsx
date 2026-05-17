'use client'

import Link from 'next/link'
import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { SECTION_META, ACCENT_CLASSES } from '@/lib/utils'
import type { ContentSection } from '@/lib/content'

interface StatItem {
  key:   ContentSection
  count: number
}

function AnimatedCount({ value }: { value: number }) {
  const spring  = useSpring(0, { stiffness: 80, damping: 20 })
  const display = useTransform(spring, (v) => Math.round(v))

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  return <motion.span>{display}</motion.span>
}

export function StatsBar({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-10">
      {stats.map(({ key, count }, i) => {
        const meta = SECTION_META[key]
        const ac   = ACCENT_CLASSES[meta.accent]
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.2 }}
          >
            <Link
              href={meta.href}
              className={`flex flex-col items-center rounded-xl border px-3 py-3 text-center hover:opacity-80 transition-opacity ${ac.border} ${ac.bg}`}
            >
              <span className={`text-xl font-bold font-mono leading-none ${ac.text}`}>
                {count > 0 ? <AnimatedCount value={count} /> : '0'}
              </span>
              <span className="mt-1.5 text-[10px] text-surface-500 uppercase tracking-wide font-mono">
                {meta.title}
              </span>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}
