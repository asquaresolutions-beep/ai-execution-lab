'use client'
// components/trustseal/command/account-menu.tsx
// Top-right account control for the Command Center. Uses the shared auth session:
// shows a single safe initial (never the email) and a small menu of actions that
// already exist in TrustSeal — nothing more.
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'

const C = { text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', line: 'rgba(120,160,255,0.16)' }

export function AccountMenu({ locale, verifiedDomain }: { locale: string; verifiedDomain: string | null }) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const initial = (user?.name || '').trim().charAt(0).toUpperCase() || '•'
  const L = (s: string) => `/${locale}${s}`
  const item = 'block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-white/5'

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold" style={{ background: 'linear-gradient(135deg,#8b5cf6,#22d3ee)', color: '#06121e' }}>
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-60 rounded-xl border p-1.5 shadow-xl"
          style={{ borderColor: C.line, background: 'rgba(8,12,22,0.97)', color: C.text1 }}>
          <p className="px-3 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: C.text3 }}>Signed in</p>
          <a role="menuitem" className={item} href={L('/dashboard')}>Dashboard <span style={{ color: C.text3 }}>· domains, billing, API, monitoring</span></a>
          <a role="menuitem" className={item} href={L('/dashboard')}>Add a domain</a>
          {verifiedDomain && <a role="menuitem" className={item} href={L(`/trust/${verifiedDomain}`)}>Public seal page</a>}
          {verifiedDomain && <a role="menuitem" className={item} href={L(`/certificate/${verifiedDomain}`)}>Certificate</a>}
          <div className="my-1 h-px" style={{ background: C.line }} />
          <button role="menuitem" type="button" className={item} style={{ color: C.text2 }} onClick={() => { setOpen(false); signOut() }}>Sign out</button>
        </div>
      )}
    </div>
  )
}
