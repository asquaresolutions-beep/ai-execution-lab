import { notFound } from 'next/navigation'
import { getItem, getAllSlugs, getNeighbors } from '@/lib/content'
import { ContentPage } from '@/components/content-page'
import { buildArticleMetadata } from '@/lib/metadata'
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
  return <ContentPage item={item} prev={prev} next={next} />
}
