// Table of Contents utilities — extract headings from raw MDX content

export interface TocHeading {
  id:    string
  text:  string
  level: 2 | 3
}

/**
 * Extract H2 and H3 headings from raw MDX content.
 * Produces IDs that match what rehype-slug generates.
 */
export function extractHeadings(content: string): TocHeading[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm
  const matches = [...content.matchAll(headingRegex)]

  return matches.map((m) => {
    const level = m[1].length as 2 | 3
    const rawText = m[2]
      .replace(/\*\*(.+?)\*\*/g, '$1')   // strip bold
      .replace(/\*(.+?)\*/g, '$1')        // strip italic
      .replace(/`(.+?)`/g, '$1')          // strip inline code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // strip links
      .trim()

    const id = rawText
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')   // remove special chars
      .replace(/[\s_]+/g, '-')    // spaces/underscores → hyphens
      .replace(/-+/g, '-')        // collapse multiple hyphens
      .replace(/^-|-$/g, '')      // trim

    return { id, text: rawText, level }
  })
}
