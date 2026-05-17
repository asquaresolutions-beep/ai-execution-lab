import { getAllMeta } from '@/lib/content'
import { SectionIndex } from '@/components/section-index'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Case Studies',
  description: 'Real results from asquaresolution.com, TrustSeal, and ScamCheck.',
}

export default function CaseStudiesPage() {
  const items = getAllMeta('case-studies')
  return <SectionIndex section="case-studies" items={items} />
}
