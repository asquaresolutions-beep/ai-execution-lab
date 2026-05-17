import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllSlugs, getItem } from '@/lib/content'
import { ContentPage } from '@/components/content-page'

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
  const fm = item.frontmatter
  return {
    title: fm.title,
    description: fm.description,
    openGraph: { title: fm.title, description: fm.description },
  }
}

export default async function PlaybookPage({ params }: PageProps) {
  const { slug } = await params
  const item = getItem('playbooks', slug)
  if (!item) notFound()
  return <ContentPage item={item} />
}
