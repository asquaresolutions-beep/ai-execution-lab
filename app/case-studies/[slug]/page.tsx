import { notFound } from 'next/navigation'
import { getItem, getAllSlugs, getNeighbors } from '@/lib/content'
import { ContentPage } from '@/components/content-page'
import { buildArticleMetadata } from '@/lib/metadata'
import { CrossRelated } from '@/components/operational/cross-related'
import { LinkedIncidents } from '@/components/operational/linked-incidents'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllSlugs('case-studies').map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = getItem('case-studies', slug)
  if (!item) return {}
  return buildArticleMetadata(item)
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params
  const item = getItem('case-studies', slug)
  if (!item) notFound()
  const { prev, next } = getNeighbors('case-studies', slug)

  const afterContent = (
    <div className="mt-10 space-y-6">
      <LinkedIncidents section="case-studies" slug={slug} />
      <CrossRelated    section="case-studies" slug={slug} />
    </div>
  )

  return <ContentPage item={item} prev={prev} next={next} afterContent={afterContent} />
}
