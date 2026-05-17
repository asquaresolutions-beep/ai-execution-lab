import type { Metadata } from 'next'
import { getAllMeta } from '@/lib/content'
import { SectionIndex } from '@/components/section-index'
import { buildSectionMetadata } from '@/lib/metadata'

export const metadata: Metadata = buildSectionMetadata(
  'Playbooks',
  'Step-by-step execution guides for repeatable operations. Prerequisites, steps, expected outcomes, failure modes.',
  '/playbooks',
)

export default function PlaybooksPage() {
  const items = getAllMeta('playbooks')
  return <SectionIndex section="playbooks" items={items} />
}
