// lib/authors.ts — Lab author registry (single author for now).
export interface Author {
  slug: string
  name: string
  role: string
  org: string
  orgUrl: string
  website: string
  linkedin: string
  bio: string
}

export const AUTHORS: Record<string, Author> = {
  'anis-ansari': {
    slug: 'anis-ansari',
    name: 'Anis Ansari',
    role: 'Founder, A Square Solutions',
    org: 'A Square Solutions',
    orgUrl: 'https://asquaresolution.com',
    website: 'https://asquaresolution.com',
    linkedin: 'https://www.linkedin.com/company/a-square-solutions',
    bio: 'Anis Ansari is the founder of A Square Solutions, where he builds and ships production AI systems, SEO engineering pipelines, and GEO strategies. The AI Execution Lab is his public engineering journal — real workflows, failures, and operational records from building tools like ScamCheck and TrustSeal.',
  },
}

export const DEFAULT_AUTHOR = AUTHORS['anis-ansari']

export function authorSlugFromName(name?: string): string {
  if (!name) return DEFAULT_AUTHOR.slug
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function getAuthor(nameOrSlug?: string): Author {
  if (!nameOrSlug) return DEFAULT_AUTHOR
  return AUTHORS[nameOrSlug] ?? AUTHORS[authorSlugFromName(nameOrSlug)] ?? DEFAULT_AUTHOR
}

export function allAuthorSlugs(): string[] {
  return Object.keys(AUTHORS)
}
