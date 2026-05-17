import type { Metadata } from 'next'
import { getAllMeta } from '@/lib/content'
import { SectionIndex } from '@/components/section-index'

export const metadata: Metadata = {
  title: 'Playbooks',
  description: 'Step-by-step execution guides for repeatable operations. Prerequisites, steps, expected outcomes, failure modes.',
}

export default function PlaybooksPage() {
  const items = getAllMeta('playbooks')
  return <SectionIndex section="playbooks" items={items} />
}
