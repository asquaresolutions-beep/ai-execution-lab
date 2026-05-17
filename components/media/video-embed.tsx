// Local video embed — HTML5 video with optional poster + caption
// Usage in MDX: <VideoEmbed src="/videos/demo.mp4" poster="/videos/poster.jpg" caption="Demo" />

export function VideoEmbed({
  src,
  poster,
  caption,
  autoplay = false,
}: {
  src: string
  poster?: string
  caption?: string
  autoplay?: boolean
}) {
  return (
    <figure className="my-8">
      <div className="rounded-xl overflow-hidden border border-surface-700/60 shadow-lg bg-surface-950">
        <video
          src={src}
          poster={poster}
          controls
          playsInline
          autoPlay={autoplay}
          muted={autoplay}
          loop={autoplay}
          className="w-full"
          preload="metadata"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-surface-500 font-mono">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
