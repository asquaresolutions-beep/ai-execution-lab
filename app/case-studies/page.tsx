import { getAllMeta } from '@/lib/content'
import { SectionIndex } from '@/components/section-index'
import { buildSectionMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'

export const metadata: Metadata = buildSectionMetadata(
  'Case Studies',
  'Real results from asquaresolution.com, TrustSeal, and ScamCheck — documented with evidence.',
  '/case-studies',
)

export default function CaseStudiesPage() {
  const items = getAllMeta('case-studies')
  return <SectionIndex section="case-studies" items={items} />
}
