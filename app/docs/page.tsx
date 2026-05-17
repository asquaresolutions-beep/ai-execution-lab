import { getAllMeta } from '@/lib/content'
import { SectionIndex } from '@/components/section-index'
import { buildSectionMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'

export const metadata: Metadata = buildSectionMetadata(
  'Docs',
  'Reference documentation for Claude Code, GEO, LiteSpeed, and AI workflow systems.',
  '/docs',
)

export default function DocsPage() {
  const items = getAllMeta('docs')
  return <SectionIndex section="docs" items={items} />
}
