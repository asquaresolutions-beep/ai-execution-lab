import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveScamPage } from '@/lib/seo/programmatic'
import { allScamPathSlugs } from '@/lib/seo/paths'
import { ProgrammaticPage } from '@/components/seo/programmatic-page'

// Fully static: prerender every path at build time, no runtime AI/DB.
export const dynamic = 'error'
export const dynamicParams = false

interface Props { params: Promise<{ slug?: string[] }> }

export function generateStaticParams(): { slug?: string[] }[] {
  return allScamPathSlugs().map((slug) => (slug.length ? { slug } : { slug: undefined }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const model = resolveScamPage(slug ?? [])
  if (!model) return {}
  const og = model.discover.imageRecommendation.ogImagePath
  return {
    // Absolute: these are ScamCheck-branded pages; don't append the lab title template.
    title: { absolute: model.title },
    description: model.metaDescription,
    alternates: { canonical: model.canonical },
    robots: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    openGraph: {
      title: model.discover.headline,
      description: model.metaDescription,
      url: model.canonical,
      type: 'article',
      images: [{ url: og, width: 1200, height: 630, alt: model.discover.imageRecommendation.altText }],
    },
    twitter: { card: 'summary_large_image', title: model.discover.headline, description: model.metaDescription },
  }
}

export default async function ScamProgrammaticPage({ params }: Props) {
  const { slug } = await params
  const model = resolveScamPage(slug ?? [])
  if (!model) notFound()
  return <ProgrammaticPage model={model} />
}
