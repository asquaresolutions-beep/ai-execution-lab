import { notFound } from 'next/navigation'
import Link from 'next/link'
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
            {/* Recovery procedure callout — links all failure pages to the runbook */}
            <Link
              href="/playbooks/recovery-runbook"
              className="not-prose flex items-center justify-between rounded-lg border border-yellow-500/20 bg-yellow-500/[0.04] px-4 py-3 transition-colors hover:border-yellow-500/35 hover:bg-yellow-500/[0.07] group"
            >
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-yellow-500/60 mb-0.5">
                  Recovery Procedure
                </p>
                <p className="text-sm font-medium text-white/70 group-hover:text-white/90 transition-colors">
                  Recovery Runbook — A Square Solutions
                </p>
                <p className="text-xs text-white/35 mt-0.5">
                  System-specific recovery steps for every documented failure class
                </p>
              </div>
              <span className="text-yellow-500/50 group-hover:text-yellow-500/80 transition-colors ml-4 shrink-0 text-sm">
                →
              </span>
            </Link>
            <LinkedIncidents section="failures" slug={slug} />
            <CrossRelated section="failures" slug={slug} />
            <DebugContextPanel slug={slug} />
          </div>
        }
      />
    </>
  )
}
