'use client'

import { motion } from 'framer-motion'

// template.tsx re-mounts on every navigation (unlike layout.tsx which persists).
// This gives us clean page-transition animations without complex AnimatePresence wiring.

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}
