import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllSlugs, getItem, getNeighbors } from '@/lib/content'
import { ContentPage } from '@/components/content-page'
import { buildArticleMetadata } from '@/lib/metadata'
import { CrossRelated } from '@/components/operational/cross-related'
import { LinkedIncidents } from '@/components/operational/linked-incidents'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllSlugs('playbooks').map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const item = getItem('playbooks', slug)
  if (!item) return {}
  return buildArticleMetadata(item)
}

export default async function PlaybookPage({ params }: PageProps) {
  const { slug } = await params
  const item = getItem('playbooks', slug)
  if (!item) notFound()
  const { prev, next } = getNeighbors('playbooks', slug)

  const afterContent = (
    <div className="mt-10 space-y-6">
      <LinkedIncidents section="playbooks" slug={slug} />
      <CrossRelated    section="playbooks" slug={slug} />
    </div>
  )

  return <ContentPage item={item} prev={prev} next={next} afterContent={afterContent} />
}
