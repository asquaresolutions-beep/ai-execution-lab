import { getAllMeta } from '@/lib/content'
import { SectionIndex } from '@/components/section-index'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Systems',
  description: 'Documented production systems: architecture decisions, failure modes, and maintenance notes.',
}

export default function SystemsPage() {
  const items = getAllMeta('systems')
  return <SectionIndex section="systems" items={items} />
}
