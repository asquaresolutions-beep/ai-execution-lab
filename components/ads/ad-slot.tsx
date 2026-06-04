'use client'

// components/ads/ad-slot.tsx
// CLS-safe, lazy-loaded Google AdSense unit. The container reserves a fixed
// min-height before the ad fills it (no layout shift). The <ins> is only
// initialised when it scrolls near the viewport (lazy), and only after the
// adsbygoogle script is present. Google Consent Mode (set in the root layout)
// governs personalization — non-personalised ads serve when consent is denied,
// so this stays GDPR-compliant without blocking the unit.
//
// Placement policy: content pages only (results, intelligence, database,
// latest, article bodies, footer) — never adjacent to upload buttons or the
// trust/credits UI, per AdSense placement policy.

import { useEffect, useRef, useState } from 'react'

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-3102382127523426'

// Real ad units under the A Square Solutions publisher account. Override per
// placement with the `slot` prop once ScamCheck-specific units are created.
type Format = 'horizontal' | 'rectangle' | 'leaderboard' | 'in-article' | 'multiplex'
const UNIT: Record<Format, { slot: string; adFormat: string; layout?: string; minH: string }> = {
  horizontal:  { slot: '7604530609', adFormat: 'auto',       minH: 'min-h-[100px]' },
  leaderboard: { slot: '7604530609', adFormat: 'auto',       minH: 'min-h-[90px]'  },
  rectangle:   { slot: '7604530609', adFormat: 'auto',       minH: 'min-h-[250px]' },
  'in-article':{ slot: '1904220590', adFormat: 'fluid',      layout: 'in-article', minH: 'min-h-[120px]' },
  multiplex:   { slot: '9828324601', adFormat: 'autorelaxed', minH: 'min-h-[200px]' },
}

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

export function AdSlot({ id, format = 'horizontal', slot, className = '' }: { id: string; format?: Format; slot?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const pushed = useRef(false)
  const [inView, setInView] = useState(false)
  const u = UNIT[format]

  // Lazy: reveal when within 300px of the viewport.
  useEffect(() => {
    if (!ref.current || inView) return
    const el = ref.current
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setInView(true) }),
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  // Initialise the unit once, after it's in view and the script is available.
  useEffect(() => {
    if (!inView || pushed.current || !ADSENSE_CLIENT) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch {
      /* adsbygoogle not ready yet — will retry on next in-view effect run */
    }
  }, [inView])

  // No publisher configured → render nothing (never force an empty ad frame).
  if (!ADSENSE_CLIENT) return null

  return (
    <aside ref={ref} aria-label="advertisement" data-ad-container={id} className={`my-6 flex w-full justify-center ${className}`}>
      <div className={`w-full ${u.minH}`}>
        {inView && (
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '100%' }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={slot || u.slot}
            data-ad-format={u.adFormat}
            {...(u.layout ? { 'data-ad-layout': u.layout } : {})}
            data-full-width-responsive="true"
          />
        )}
      </div>
    </aside>
  )
}
