import { notFound } from 'next/navigation'
import { getItem, getAllSlugs, getNeighbors } from '@/lib/content'
import { ContentPage } from '@/components/content-page'
import { DebugContextPanel } from '@/components/operational/debug-context-panel'
import { CrossRelated } from '@/components/operational/cross-related'
import { LinkedIncidents } from '@/components/operational/linked-incidents'
import { buildFailureMetadata, buildHowToSchema } from '@/lib/metadata'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllSlugs('failures').map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = getItem('failures', slug)
  if (!item) return {}
  return buildFailureMetadata(item)
}

export default async function FailurePage({ params }: Props) {
  const { slug } = await params
  const item = getItem('failures', slug)
  if (!item) notFound()
  const { prev, next } = getNeighbors('failures', slug)

  const howToSchema = buildHowToSchema(item)

  return (
    <>
      {/* HowTo JSON-LD — surfaces in AI search for "how to fix X" queries */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <ContentPage
        item={item}
        prev={prev}
        next={next}
        afterContent={
          <div className="flex flex-col gap-8 mt-10">
            <LinkedIncidents section="failures" slug={slug} />
            <CrossRelated section="failures" slug={slug} />
            <DebugContextPanel slug={slug} />
          </div>
        }
      />
    </>
  )
}
