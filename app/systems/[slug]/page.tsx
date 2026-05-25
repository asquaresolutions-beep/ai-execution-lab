import { notFound } from 'next/navigation'
import { getItem, getAllSlugs, getNeighbors } from '@/lib/content'
import { ContentPage } from '@/components/content-page'
import { buildArticleMetadata } from '@/lib/metadata'
import { CrossRelated } from '@/components/operational/cross-related'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllSlugs('systems').map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = getItem('systems', slug)
  if (!item) return {}
  return buildArticleMetadata(item)
}

export default async function SystemPage({ params }: Props) {
  const { slug } = await params
  const item = getItem('systems', slug)
  if (!item) notFound()
  const { prev, next } = getNeighbors('systems', slug)

  const afterContent = (
    <div className="mt-10">
      <CrossRelated section="systems" slug={slug} />
    </div>
  )

  return <ContentPage item={item} prev={prev} next={next} afterContent={afterContent} />
}
