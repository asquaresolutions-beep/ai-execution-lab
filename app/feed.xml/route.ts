// app/feed.xml/route.ts — RSS 2.0 feed for the AI Execution Lab content.
// Uses the lab domain explicitly (NEXT_PUBLIC_SITE_URL is the ScamCheck domain
// in production, so we must not derive lab URLs from it).
import { getRecentItems } from '@/lib/content'
import { SECTION_META } from '@/lib/utils'

export const dynamic = 'force-static'

const BASE = process.env.NEXT_PUBLIC_LAB_URL ?? 'https://lab.asquaresolution.com'

const esc = (s: string) =>
  String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))

export async function GET() {
  const items = getRecentItems(50)
  const now = new Date().toUTCString()

  const entries = items.map((i) => {
    const url = `${BASE}${SECTION_META[i.section].href}/${i.slug}`
    const fm = i.frontmatter
    const pub = new Date(fm.updated ?? fm.date).toUTCString()
    return `    <item>
      <title>${esc(fm.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pub}</pubDate>
      <category>${esc(SECTION_META[i.section].label)}</category>
      ${fm.author ? `<dc:creator>${esc(fm.author)}</dc:creator>` : ''}
      <description>${esc(fm.description ?? '')}</description>
    </item>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>AI Execution Lab — A Square Solutions</title>
    <link>${BASE}</link>
    <description>Real AI workflows, systems, failures, and research from building production tools.</description>
    <language>en</language>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${now}</lastBuildDate>
${entries}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
