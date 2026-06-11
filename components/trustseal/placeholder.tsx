// components/trustseal/placeholder.tsx  (asq-trustseal-a1)
// Minimal token-driven placeholder for Phase-A TrustSeal scaffold pages.
// Server component (no client JS, no animation). Uses only the scoped
// --ts-* tokens, so it proves token isolation works inside the wrapper.
// Replaced by real surfaces in Phase C.
export function TrustSealPlaceholder({
  title,
  subtitle,
  locale,
}: {
  title: string
  subtitle: string
  locale: string
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--ts-accent))' }}>
        TrustSeal · Phase A scaffold
      </p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ color: 'rgb(var(--ts-text-1))' }}>
        {title}
      </h1>
      <p className="mt-3 text-base" style={{ color: 'rgb(var(--ts-text-2))' }}>
        {subtitle}
      </p>
      <div
        className="mt-8 rounded-xl border p-4 text-sm"
        style={{
          borderColor: 'rgb(var(--ts-border))',
          backgroundColor: 'rgb(var(--ts-surface-2))',
          color: 'rgb(var(--ts-text-2))',
        }}
      >
        Placeholder — English only, no translations yet. Locale segment:{' '}
        <code style={{ color: 'rgb(var(--ts-accent-soft))' }}>{locale}</code>. Text direction is set on the
        TrustSeal wrapper (RTL-ready for <code style={{ color: 'rgb(var(--ts-accent-soft))' }}>ar</code>).
      </div>
    </main>
  )
}
