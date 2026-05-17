import { getAllMeta } from '@/lib/content'
import { SectionIndex } from '@/components/section-index'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Labs',
  description: 'Active research and experiments. Hypothesis, method, findings — all from real execution.',
}

export default function LabsPage() {
  const items = getAllMeta('labs')
  return <SectionIndex section="labs" items={items} />
}
