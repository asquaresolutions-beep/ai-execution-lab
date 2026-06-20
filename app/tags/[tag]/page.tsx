import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildTagIndex, getAllTagSlugs, getTagItems } from '@/lib/tags'
import { SECTION_META, ACCENT_CLASSES, formatDateMono } from '@/lib/utils'
import { getEntityMeta, categoryLabel, type EntityMeta } from '@/lib/entities'

const SITE_URL  = 'https://lab.asquaresolution.com' // pinned to Lab host (see lib/metadata.ts)
const SITE_NAME = 'AI Execution Lab'
const TWITTER   = '@asquaresolution'

interface Props { params: Promise<{ tag: string }> }

/** Schema.org @type for each entity category */
function entitySchemaType(entity: EntityMeta): string {
  switch (entity.category) {
    case 'platform':    return 'SoftwareApplication'
    case 'tool':        return 'SoftwareApplication'
    case 'product':     return 'SoftwareApplication'
    case 'service':     return 'Service'
    case 'technology':  return 'DefinedTerm'
    case 'concept':     return 'DefinedTerm'
  }
}

/** Build Schema.org JSON-LD for an entity page */
function buildEntitySchema(entity: EntityMeta, url: string, itemCount: number) {
  const schemaType = entitySchemaType(entity)
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type':    schemaType,
    '@id':      `${url}#entity`,
    name:       entity.name,
    description: entity.description,
    url,
  }
  if (entity.docs_url) base['sameAs'] = entity.docs_url
  if (schemaType === 'SoftwareApplication') {
    base['applicationCategory'] = categoryLabel(entity.category)
    base['operatingSystem'] = 'Web'
  }
  // Wrap with a page that mentions this entity
  return {
    '@context': 'https://schema.org',
    '@graph': [
      base,
      {
        '@type': 'CollectionPage',
        '@id':   `${url}#page`,
        name:    `${entity.name} — AI Execution Lab`,
        description: `${itemCount} operational records referencing ${entity.name} across A Square Solutions infrastructure.`,
        url,
        about: { '@id': `${url}#entity` },
        publisher: { '@id': 'https://asquaresolution.com/#organization' },
      },
    ],
  }
}

/** Category badge colour classes */
function categoryBadge(entity: EntityMeta): string {
  switch (entity.category) {
    case 'platform':   return 'bg-violet-500/10 text-violet-300 border-violet-500/20'
    case 'tool':       return 'bg-brand-500/10 text-brand-300 border-brand-500/20'
    case 'product':    return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
    case 'service':    return 'bg-amber-500/10 text-amber-300 border-amber-500/20'
    case 'technology': return 'bg-sky-500/10 text-sky-300 border-sky-500/20'
    case 'concept':    return 'bg-rose-500/10 text-rose-300 border-rose-500/20'
  }
}

/** Status dot colour */
function statusColor(status?: string): string {
  if (status === 'active')      return 'bg-emerald-400'
  if (status === 'deprecated')  return 'bg-rose-400'
  if (status === 'evaluating')  return 'bg-amber-400'
  return 'bg-surface-600'
}

export async function generateStaticParams() {
  return getAllTagSlugs().map((tag) => ({ tag }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag }   = await params
  const items     = getTagItems(tag)
  if (items.length === 0) return {}
  const entity    = getEntityMeta(tag)
  const title       = entity ? entity.name : `#${tag}`
  const description = entity
    ? `${entity.description} — ${items.length} operational records in AI Execution Lab.`
    : `${items.length} items tagged #${tag} — AI execution documentation, failure reports, labs, and logs.`
  const url         = `${SITE_URL}/tags/${tag}`
  return {
    title,
    description,
    ...(items.length < 3 ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: 'website',
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card:    'summary',
      title:   `${title} | ${SITE_NAME}`,
      description,
      creator: TWITTER,
    },
    alternates: { canonical: url },
  }
}

export default async function TagPage({ params }: Props) {
  const { tag }  = await params
  const items    = getTagItems(tag)
  if (items.length === 0) notFound()

  const entity   = getEntityMeta(tag)
  const allTags  = buildTagIndex()
  const related  = allTags
    .filter(e => e.tag !== tag && e.items.some(i => items.some(j => j.slug === i.slug)))
    .slice(0, 8)

  const url = `${SITE_URL}/tags/${tag}`

  // Section breakdown for entity stat bar
  const sectionCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.section] = (acc[item.section] ?? 0) + 1
    return acc
  }, {})
  const failureCount = sectionCounts['failures'] ?? 0
  const logCount     = sectionCounts['logs']     ?? 0

  // Entity intelligence — computed from already-loaded items (no extra I/O)
  const failureItems = items.filter(i => i.section === 'failures')
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())
  const mostRecentIncident = failureItems[0]?.frontmatter.date ?? null
  const deploymentItems    = items.filter(i => i.section === 'logs' &&
    (i.frontmatter.log_type === 'deployment' || i.frontmatter.log_type === 'release'))
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime())

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      {/* Schema.org JSON-LD for entity pages */}
      {entity && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildEntitySchema(entity, url, items.length)) }}
        />
      )}

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-surface-600">
        <Link href="/" className="hover:text-surface-400 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/tags" className="hover:text-surface-400 transition-colors">Topics</Link>
        <span>/</span>
        <span className="text-surface-500">{entity ? entity.name : `#${tag}`}</span>
      </nav>

      {/* ── Entity header (rich) ── */}
      {entity ? (
        <div className="mb-10 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-6">
          {/* Top row: name + badges */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h1 className="text-2xl font-bold tracking-tight text-surface-50">
              {entity.name}
            </h1>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${categoryBadge(entity)}`}>
              {categoryLabel(entity.category)}
            </span>
            {entity.status && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor(entity.status)}`} />
                {entity.status}
              </span>
            )}
            {entity.since && (
              <span className="text-[11px] font-mono text-surface-700">since {entity.since}</span>
            )}
          </div>

          {/* Operational description */}
          <p className="text-sm text-surface-400 leading-relaxed mb-5 max-w-3xl">
            {entity.description}
          </p>

          {/* Stat row */}
          <div className="flex flex-wrap gap-5 mb-5 text-[11px] font-mono">
            <span className="text-surface-600">
              <span className="text-surface-300 font-semibold">{items.length}</span> operational records
            </span>
            {failureCount > 0 && (
              <span className="text-surface-600">
                <span className="text-rose-400 font-semibold">{failureCount}</span> failure{failureCount !== 1 ? 's' : ''}
              </span>
            )}
            {logCount > 0 && (
              <span className="text-surface-600">
                <span className="text-sky-400 font-semibold">{logCount}</span> log{logCount !== 1 ? 's' : ''}
              </span>
            )}
            {Object.entries(sectionCounts)
              .filter(([s]) => s !== 'failures' && s !== 'logs')
              .map(([s, n]) => (
                <span key={s} className="text-surface-600">
                  <span className="text-surface-300 font-semibold">{n}</span> {s}
                </span>
              ))}
          </div>

          {/* Failure timeline — documented incidents for this entity */}
          {failureItems.length > 0 && (
            <div className="mb-5 border-t border-white/[0.05] pt-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-surface-700 block mb-2">
                Documented failures
                {mostRecentIncident && (
                  <span className="ml-2 text-rose-400 normal-case tracking-normal">
                    · last {mostRecentIncident}
                  </span>
                )}
              </span>
              <ul className="space-y-1">
                {failureItems.slice(0, 4).map(f => (
                  <li key={f.slug}>
                    <Link
                      href={`/failures/${f.slug}`}
                      className="flex items-center gap-2 group text-[11px] font-mono hover:text-surface-100 transition-colors"
                    >
                      <span className="h-1 w-1 rounded-full bg-rose-500/60 shrink-0" />
                      <span className="text-surface-500 group-hover:text-surface-200 truncate">{f.frontmatter.title}</span>
                      <span className="text-surface-700 shrink-0">{f.frontmatter.date}</span>
                    </Link>
                  </li>
                ))}
                {failureItems.length > 4 && (
                  <li className="text-[10px] font-mono text-surface-700 pl-3">
                    +{failureItems.length - 4} more below ↓
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Deployment history — most recent deployments touching this entity */}
          {deploymentItems.length > 0 && (
            <div className="mb-5 border-t border-white/[0.05] pt-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-surface-700 block mb-2">
                Recent deployment history
              </span>
              <ul className="space-y-1">
                {deploymentItems.slice(0, 3).map(d => (
                  <li key={d.slug}>
                    <Link
                      href={`/logs/${d.slug}`}
                      className="flex items-center gap-2 group text-[11px] font-mono hover:text-surface-100 transition-colors"
                    >
                      <span className="h-1 w-1 rounded-full bg-emerald-500/60 shrink-0" />
                      <span className="text-surface-500 group-hover:text-surface-200 truncate">{d.frontmatter.title}</span>
                      <span className="text-surface-700 shrink-0">{d.frontmatter.date}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Relationship links */}
          {((entity.depends_on?.length ?? 0) > 0 || (entity.used_by?.length ?? 0) > 0 || entity.docs_url) && (
            <div className="flex flex-wrap gap-6 text-xs border-t border-white/[0.05] pt-4">
              {entity.depends_on && entity.depends_on.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-surface-700 block mb-1.5">Depends on</span>
                  <div className="flex flex-wrap gap-1.5">
                    {entity.depends_on.map(dep => (
                      <Link
                        key={dep}
                        href={`/tags/${dep}`}
                        className="inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-0.5 text-[11px] font-mono text-surface-500 hover:text-surface-200 hover:border-white/[0.14] transition-all"
                      >
                        {dep}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {entity.used_by && entity.used_by.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-surface-700 block mb-1.5">Used by</span>
                  <div className="flex flex-wrap gap-1.5">
                    {entity.used_by.map(dep => (
                      <Link
                        key={dep}
                        href={`/tags/${dep}`}
                        className="inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-0.5 text-[11px] font-mono text-surface-500 hover:text-surface-200 hover:border-white/[0.14] transition-all"
                      >
                        {dep}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {entity.docs_url && (
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-surface-700 block mb-1.5">Docs</span>
                  <a
                    href={entity.docs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    {entity.docs_url.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Plain tag header ── */
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-surface-50 mb-2">
            #{tag}
          </h1>
          <p className="text-sm text-surface-500">
            {items.length} {items.length === 1 ? 'item' : 'items'} across{' '}
            {new Set(items.map(i => i.section)).size} sections
          </p>
        </div>
      )}

      {/* ── Content list ── */}
      <div className="space-y-2 mb-10">
        {entity && (
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-700 mb-3">
            Operational records — {items.length} total
          </p>
        )}
        {items.map((item) => {
          const meta = SECTION_META[item.section]
          const ac   = ACCENT_CLASSES[meta.accent]
          return (
            <Link
              key={`${item.section}/${item.slug}`}
              href={`${meta.href}/${item.slug}`}
              className="group flex items-start gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-4 hover:border-white/[0.10] hover:bg-white/[0.04] transition-all"
            >
              {/* Date */}
              <time className="text-[11px] font-mono text-surface-700 shrink-0 w-20 pt-0.5 hidden sm:block">
                {formatDateMono(item.frontmatter.date)}
              </time>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-[10px] font-mono font-semibold uppercase shrink-0 ${ac.text}`}>
                    {meta.label}
                  </span>
                  <span className="text-sm font-medium text-surface-200 group-hover:text-surface-50 transition-colors truncate">
                    {item.frontmatter.title}
                  </span>
                </div>
                {item.frontmatter.description && (
                  <p className="text-sm text-surface-500 line-clamp-1 leading-snug">
                    {item.frontmatter.description}
                  </p>
                )}
                {/* Other tags on this item */}
                {item.frontmatter.tags && item.frontmatter.tags.length > 1 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 hidden sm:flex">
                    {item.frontmatter.tags
                      .filter(t => t !== tag)
                      .slice(0, 4)
                      .map(t => (
                        <Link
                          key={t}
                          href={`/tags/${t}`}
                          className="text-[10px] text-surface-700 hover:text-brand-400 transition-colors"
                        >
                          #{t}
                        </Link>
                      ))}
                  </div>
                )}
              </div>

              {/* Reading time */}
              <div className="shrink-0 text-[11px] font-mono text-surface-700 pt-0.5 hidden md:block">
                {item.readingTime}
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── Related tags ── */}
      {related.length > 0 && (
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-700 mb-3">
            Related topics
          </p>
          <div className="flex flex-wrap gap-2">
            {related.map(({ tag: t, count }) => (
              <Link
                key={t}
                href={`/tags/${t}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1 text-xs font-mono text-surface-500 hover:text-surface-200 hover:border-white/[0.14] transition-all"
              >
                #{t}
                <span className="text-surface-700">{count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
