import type { Metadata } from 'next'

// Embed routes are iframed inside external blog articles. They must NOT be indexed
// as standalone pages (the canonical experience is the ScamCheck checker), and they
// render chrome-free (SiteChrome skips the 'embed' segment).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return children
}
