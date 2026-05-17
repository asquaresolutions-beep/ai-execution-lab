import { notFound } from 'next/navigation'
import { getItem, getAllSlugs, getNeighbors } from '@/lib/content'
import { ContentPage } from '@/components/content-page'
import { buildArticleMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllSlugs('logs').map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = getItem('logs', slug)
  if (!item) return {}
  return buildArticleMetadata(item)
}

export default async function LogPage({ params }: Props) {
  const { slug } = await params
  const item = getItem('logs', slug)
  if (!item) notFound()
  const { prev, next } = getNeighbors('logs', slug)
  return <ContentPage item={item} prev={prev} next={next} />
}
