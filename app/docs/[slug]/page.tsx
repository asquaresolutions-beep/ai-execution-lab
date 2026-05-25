import { notFound } from 'next/navigation'
import { getItem, getAllSlugs, getNeighbors } from '@/lib/content'
import { ContentPage } from '@/components/content-page'
import { buildArticleMetadata } from '@/lib/metadata'
import { CrossRelated } from '@/components/operational/cross-related'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllSlugs('docs').map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = getItem('docs', slug)
  if (!item) return {}
  return buildArticleMetadata(item)
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params
  const item = getItem('docs', slug)
  if (!item) notFound()
  const { prev, next } = getNeighbors('docs', slug)

  // Docs show cross-related content (failures that reference this doc, logs, case studies)
  // LinkedIncidents not shown on docs — docs don't participate in incident chains
  const afterContent = (
    <div className="mt-10">
      <CrossRelated section="docs" slug={slug} />
    </div>
  )

  return <ContentPage item={item} prev={prev} next={next} afterContent={afterContent} />
}
