import { notFound } from 'next/navigation'
import { getItem, getAllSlugs } from '@/lib/content'
import { ContentPage } from '@/components/content-page'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllSlugs('labs').map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = getItem('labs', slug)
  if (!item) return {}
  return { title: item.frontmatter.title, description: item.frontmatter.description }
}

export default async function LabPage({ params }: Props) {
  const { slug } = await params
  const item = getItem('labs', slug)
  if (!item) notFound()
  return <ContentPage item={item} />
}
