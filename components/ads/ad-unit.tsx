'use client'
// ─────────────────────────────────────────────────────────────────
// components/ads/ad-unit.tsx
// Reusable, responsive, CLS-safe AdSense unit.
//
//  - Lazy: only initializes when scrolled near the viewport (IO).
//  - CLS-safe: reserves a fixed min-height BEFORE the ad fills, so the
//    page never shifts (good for Core Web Vitals + Lighthouse).
//  - Single-init: pushes to adsbygoogle exactly once.
//  - Paid users: renders nothing (and never pushes / loads ads).
//  - Graceful: if unconfigured (no client/slot) it renders nothing —
//    no empty boxes in dev or before AdSense is set up.
//  - Hydration-safe: client-only component; reserved wrapper matches
//    on server + first client render, decisions happen post-mount.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { usePaidUser } from './use-paid-user'

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ''

export interface AdUnitProps {
  slot: string
  /** 'auto' (responsive) | 'fluid' (in-article) | fixed format string. */
  format?: string
  /** In-article layout key (for fluid units). */
  layout?: string
  /** Reserved height to prevent layout shift. */
  minHeight?: number
  label?: boolean
  className?: string
}

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

export function AdUnit({ slot, format = 'auto', layout, minHeight = 280, label = true, className = '' }: AdUnitProps) {
  const paid = usePaidUser()
  const wrapRef = useRef<HTMLDivElement>(null)
  const pushed = useRef(false)
  const [visible, setVisible] = useState(false)

  const enabled = !!CLIENT && !!slot

  // Lazy reveal via IntersectionObserver (only when we know user is free).
  useEffect(() => {
    if (!enabled || paid !== false || visible || !wrapRef.current) return
    const el = wrapRef.current
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { setVisible(true); io.disconnect() } },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [enabled, paid, visible])

  // Single push once visible.
  useEffect(() => {
    if (!visible || pushed.current || paid !== false) return
    pushed.current = true
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { /* blocked */ }
  }, [visible, paid])

  // Paid users or unconfigured → nothing at all (no reserved gap).
  if (paid === true || !enabled) return null

  return (
    <div ref={wrapRef} className={`ad-unit my-6 ${className}`} style={{ minHeight, textAlign: 'center', overflow: 'hidden' }} aria-label="Advertisement">
      {label && <div className="mb-1 text-[10px] uppercase tracking-widest text-neutral-600">Advertisement</div>}
      {visible && paid === false && (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={CLIENT}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive="true"
          {...(layout ? { 'data-ad-layout': layout } : {})}
        />
      )}
    </div>
  )
}
