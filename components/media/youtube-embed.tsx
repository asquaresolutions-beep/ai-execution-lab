// YouTube embed — responsive 16:9 wrapper
// Usage in MDX: <YouTube id="dQw4w9WgXcQ" title="Video title" />

export function YouTube({ id, title }: { id: string; title?: string }) {
  return (
    <div className="my-8 rounded-xl overflow-hidden border border-surface-700/60 shadow-lg">
      <div className="aspect-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`}
          title={title ?? 'YouTube video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          className="w-full h-full"
        />
      </div>
      {title && (
        <div className="px-4 py-2 bg-surface-900/60 border-t border-surface-800/60">
          <p className="text-xs text-surface-500 font-mono">{title}</p>
        </div>
      )}
    </div>
  )
}
