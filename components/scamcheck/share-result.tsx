'use client'

// Share / copy a scan result. Uses the Web Share API on mobile, clipboard
// copy as fallback, and a shareable link to the tool. (Social sharing)
import { useState } from 'react'

export function ShareResult({ summary, url }: { summary: string; url?: string }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${summary}\n${shareUrl}`); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }
  const share = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'ScamCheck result', text: summary, url: shareUrl }) } catch { /* user cancelled */ }
    } else void copy()
  }
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button onClick={share} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500">Share result</button>
      <button onClick={copy} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500">{copied ? 'Copied ✓' : 'Copy result'}</button>
    </div>
  )
}
