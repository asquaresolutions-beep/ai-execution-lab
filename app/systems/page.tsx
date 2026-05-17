import { getAllMeta } from '@/lib/content'
import { SectionIndex } from '@/components/section-index'
import { buildSectionMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'

export const metadata: Metadata = buildSectionMetadata(
  'Systems',
  'Documented production systems: architecture decisions, failure modes, and maintenance notes.',
  '/systems',
)

export default function SystemsPage() {
  const items = getAllMeta('systems')
  return <SectionIndex section="systems" items={items} />
}
