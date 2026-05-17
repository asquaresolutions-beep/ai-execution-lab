// Root loading state — shown during RSC streaming and navigation fallback.
// Matches the sidebar layout so there's no layout shift during loading.

export default function Loading() {
  return (
    <div className="px-5 sm:px-6 lg:px-8 py-8 max-w-3xl animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="mb-7 flex items-center gap-2">
        <div className="h-3 w-10 rounded bg-surface-800/60" />
        <div className="h-3 w-2 rounded bg-surface-800/40" />
        <div className="h-3 w-16 rounded bg-surface-800/60" />
        <div className="h-3 w-2 rounded bg-surface-800/40" />
        <div className="h-3 w-24 rounded bg-surface-800/60" />
      </div>

      {/* Header skeleton */}
      <div className="mb-10 pb-8 border-b border-white/[0.06]">
        <div className="mb-4 flex gap-2">
          <div className="h-5 w-16 rounded bg-surface-800/60" />
          <div className="h-5 w-12 rounded bg-surface-800/40" />
        </div>
        <div className="h-8 w-3/4 rounded-lg bg-surface-800/60 mb-3" />
        <div className="h-8 w-1/2 rounded-lg bg-surface-800/40 mb-5" />
        <div className="h-4 w-full rounded bg-surface-800/40 mb-2" />
        <div className="h-4 w-5/6 rounded bg-surface-800/40 mb-5" />
        <div className="flex gap-3">
          <div className="h-3 w-20 rounded bg-surface-800/40" />
          <div className="h-3 w-16 rounded bg-surface-800/40" />
          <div className="h-3 w-14 rounded bg-surface-800/40" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-3">
        {[100, 90, 95, 80, 100, 70, 88, 75, 100, 60].map((w, i) => (
          <div
            key={i}
            className="h-4 rounded bg-surface-800/40"
            style={{ width: `${w}%` }}
          />
        ))}
        <div className="h-6" />
        {[100, 85, 92, 78].map((w, i) => (
          <div
            key={i}
            className="h-4 rounded bg-surface-800/40"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  )
}
