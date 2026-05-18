import { notFound } from 'next/navigation'
import { getItem, getAllSlugs, getNeighbors } from '@/lib/content'
import { ContentPage } from '@/components/content-page'
import { DebugContextPanel } from '@/components/operational/debug-context-panel'
import { buildArticleMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllSlugs('failures').map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = getItem('failures', slug)
  if (!item) return {}
  return buildArticleMetadata(item)
}

export default async function FailurePage({ params }: Props) {
  const { slug } = await params
  const item = getItem('failures', slug)
  if (!item) notFound()
  const { prev, next } = getNeighbors('failures', slug)

  return (
    <ContentPage
      item={item}
      prev={prev}
      next={next}
      afterContent={<DebugContextPanel slug={slug} />}
    />
  )
}
