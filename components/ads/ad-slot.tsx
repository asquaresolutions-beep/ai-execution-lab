// components/ads/ad-slot.tsx
// Reserved ad container for future AdSense integration. Renders a labeled
// placeholder with fixed height (prevents CLS) until NEXT_PUBLIC_ADSENSE_CLIENT
// is set. Intended for result pages, scam article pages, and intelligence pages
// ONLY — never adjacent to upload buttons or trust UI.

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ''

export function AdSlot({ id, format = 'horizontal', className = '' }: { id: string; format?: 'horizontal' | 'rectangle'; className?: string }) {
  const h = format === 'rectangle' ? 'min-h-[250px]' : 'min-h-[90px]'
  // When AdSense is configured later, swap this placeholder for the <ins> unit.
  return (
    <aside aria-label="advertisement" data-ad-slot={id} className={`my-6 ${className}`}>
      <div className={`flex ${h} w-full items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 text-[11px] uppercase tracking-wide text-zinc-600`}>
        {ADSENSE_CLIENT ? 'Advertisement' : 'Ad slot (reserved)'}
      </div>
    </aside>
  )
}
