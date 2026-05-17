import { getAllMeta } from '@/lib/content'
import { SectionIndex } from '@/components/section-index'
import { buildSectionMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'

export const metadata: Metadata = buildSectionMetadata(
  'Labs',
  'Active research and experiments. Hypothesis, method, findings — all from real execution.',
  '/labs',
)

export default function LabsPage() {
  const items = getAllMeta('labs')
  return <SectionIndex section="labs" items={items} />
}
