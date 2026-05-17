import { getAllMeta } from '@/lib/content'
import { SectionIndex } from '@/components/section-index'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Docs',
  description: 'Reference documentation for Claude Code, GEO, LiteSpeed, and AI workflow systems.',
}

export default function DocsPage() {
  const items = getAllMeta('docs')
  return <SectionIndex section="docs" items={items} />
}
