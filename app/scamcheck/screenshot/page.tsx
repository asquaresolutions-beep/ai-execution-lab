'use client'

// ScamCheck — Multimodal screenshot analysis UI.
// Drag/drop or pick a screenshot → preview with highlighted suspicious regions
// → editable OCR text → verdict, risk score, signals, similar known scams.
// Mobile-friendly, dark theme. Talks to POST /api/scam-intel/screenshot.

import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface VisualSignal { id: string; label: string; severity: 'info' | 'warn' | 'danger'; evidence: string }
interface OcrWord { text: string; x: number; y: number; w: number; h: number }
interface SimilarHit { id: string; title: string; url: string; confidence: number; confidenceBand: string }
interface Verdict {
  verdict: 'likely_scam' | 'suspicious' | 'likely_safe' | 'unclear'
  riskScore: number
  confidence: number
  ocr: { text: string; engine: string; lang: string; wordCount: number }
  regions: OcrWord[]
  classification: { category: string; severity: string; tactics: string[] }
  trust: { score: number; band: string }
  visualSignals: VisualSignal[]
  similar: SimilarHit[]
  deepAnalysisUsed: boolean
  deepAnalysis?: string
}

const VERDICT_STYLE: Record<Verdict['verdict'], string> = {
  likely_scam: 'bg-red-500/15 text-red-300 border-red-500/40',
  suspicious: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  likely_safe: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  unclear: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
}

export default function ScreenshotScamCheck() {
  const [preview, setPreview] = useState<string>('')
  const [nat, setNat] = useState({ w: 1, h: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Verdict | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(''); setResult(null)
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) { setError('Please upload a PNG, JPEG, or WebP screenshot.'); return }
    if (file.size > 6 * 1024 * 1024) { setError('Image too large (max 6 MB).'); return }
    const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file) })
    setPreview(dataUrl)
    setLoading(true)
    try {
      const r = await fetch('/api/scam-intel/screenshot', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl, mime: file.type }),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.detail || data.error || 'Analysis failed.'); return }
      setResult(data as Verdict)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error.')
    } finally { setLoading(false) }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f)
  }, [handleFile])

  // Scale Vision pixel boxes to the rendered image size.
  const scale = (imgRef.current?.clientWidth || nat.w) / nat.w

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-100">
      <h1 className="text-2xl font-semibold">ScamCheck — Screenshot Analysis</h1>
      <p className="mt-2 text-sm text-zinc-400">Upload a screenshot of a suspicious message, payment, or DM (WhatsApp, Telegram, SMS, banking). We extract the text, detect fraud signals, and compare it against known scam patterns.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={cn('mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition', dragOver ? 'border-sky-400 bg-sky-500/10' : 'border-zinc-700 hover:border-zinc-500')}
      >
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
        <p className="text-sm text-zinc-300">Drag &amp; drop a screenshot here, or tap to choose</p>
        <p className="mt-1 text-xs text-zinc-500">PNG / JPEG / WebP · max 6 MB · processed securely, not stored</p>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {loading && <div className="mt-4 animate-pulse text-sm text-zinc-400">Analyzing screenshot…</div>}

      {preview && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-medium text-zinc-300">Screenshot</h2>
            <div className="relative inline-block overflow-hidden rounded-lg border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={preview} alt="uploaded screenshot" className="max-w-full"
                onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })} />
              {result?.regions?.map((r, i) => (
                <span key={i} className="pointer-events-none absolute border-2 border-red-400/80 bg-red-500/20"
                  style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }} />
              ))}
            </div>
          </div>

          {result && (
            <div className="space-y-4">
              <div className={cn('rounded-lg border p-4', VERDICT_STYLE[result.verdict])}>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold capitalize">{result.verdict.replace(/_/g, ' ')}</span>
                  <span className="text-sm">Risk {result.riskScore}/100</span>
                </div>
                <div className="mt-1 text-xs opacity-80">Confidence {Math.round(result.confidence * 100)}% · {result.classification.category.replace(/_/g, ' ')} · severity {result.classification.severity}{result.deepAnalysisUsed ? ' · deep vision used' : ''}</div>
              </div>

              {result.visualSignals.length > 0 && (
                <div>
                  <h3 className="mb-1 text-sm font-medium text-zinc-300">Fraud signals</h3>
                  <ul className="space-y-1">
                    {result.visualSignals.map((s) => (
                      <li key={s.id} className="flex items-start gap-2 text-sm">
                        <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', s.severity === 'danger' ? 'bg-red-400' : s.severity === 'warn' ? 'bg-amber-400' : 'bg-zinc-400')} />
                        <span className="text-zinc-300">{s.label} <span className="text-zinc-500">— “{s.evidence}”</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.deepAnalysis && <p className="rounded-lg bg-zinc-800/50 p-3 text-sm text-zinc-300">{result.deepAnalysis}</p>}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-medium text-zinc-300">Extracted text <span className="text-xs text-zinc-500">({result.ocr.engine}, {result.ocr.lang}, {result.ocr.wordCount} words — edit to re-check)</span></h3>
            <textarea defaultValue={result.ocr.text} rows={5} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200" />
          </div>

          {result.similar.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-zinc-300">Similar known scam patterns</h3>
              <ul className="space-y-1">
                {result.similar.map((s) => (
                  <li key={s.id} className="text-sm">
                    <a href={s.url} className="text-sky-400 hover:underline" target="_blank" rel="noopener noreferrer">{s.title || s.url}</a>
                    <span className="ml-2 text-xs text-zinc-500">{s.confidenceBand} ({Math.round(s.confidence * 100)}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-zinc-500">This is an automated risk assessment, not legal or financial advice. If you suspect fraud, call the national cybercrime helpline 1930 or report at cybercrime.gov.in.</p>
        </div>
      )}
    </main>
  )
}
