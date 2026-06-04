import Link from 'next/link'
import { getAuthor } from '@/lib/authors'

// Author box rendered below every Lab article. Links to the author profile.
export function AuthorBox({ authorName }: { authorName?: string }) {
  const a = getAuthor(authorName)
  return (
    <aside className="mt-12 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-500/15 text-lg font-bold text-brand-300">
          {a.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-surface-600">Written by</p>
          <Link href={`/authors/${a.slug}`} className="text-base font-semibold text-surface-100 hover:text-brand-300 transition-colors">{a.name}</Link>
          <p className="text-xs text-surface-500">{a.role}</p>
          <p className="mt-2 text-sm leading-relaxed text-surface-400">{a.bio}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link href={`/authors/${a.slug}`} className="text-brand-400 hover:underline">All articles →</Link>
            <a href={a.website} target="_blank" rel="noopener" className="text-surface-500 hover:text-surface-300">Website</a>
            <a href={a.linkedin} target="_blank" rel="noopener" className="text-surface-500 hover:text-surface-300">LinkedIn</a>
          </div>
        </div>
      </div>
    </aside>
  )
}
