'use client'

// ScamCheck screenshot analyzer — production multimodal upload UX.
// Drag/drop · tap-to-choose (mobile gallery) · paste (Ctrl/Cmd+V) · client-side
// image optimization (canvas downscale → JPEG) to cut Vertex/OCR cost · progress
// states · visual entities · similar campaigns · country-aware reporting · i18n.
// Talks to POST /api/scam-intel/screenshot. Dark-theme, mobile-first.

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { LANGS, t, type Lang } from '@/lib/i18n/scamcheck'
import { getCountry, resolveCountryDetailed, type CountryConfig, type GeoSource } from '@/lib/scam-intel/countries'
import { useCredits, authHeaders } from '@/hooks/use-credits'
import { useAuth } from '@/components/auth/auth-provider'

interface VisualSignal { id: string; label: string; severity: 'info' | 'warn' | 'danger'; evidence: string }
interface OcrWord { text: string; x: number; y: number; w: number; h: number }
interface SimilarHit { id: string; title: string; url: string; confidence: number; confidenceBand: string }
interface Entities { phones: string[]; urls: string[]; shorteners: string[]; upiIds: string[]; amounts: string[]; qrPaymentRefs: string[]; urgencyMarkers: string[]; impersonationMarkers: string[] }
interface Verdict {
  verdict: 'likely_scam' | 'suspicious' | 'likely_safe' | 'unclear' | 'needs_review'
  riskScore: number; scamProbability: number; trustScore: number; confidence: number
  explanation: string; safetyAdvice: string[]
  ocr: { text: string; engine: string; lang: string; wordCount: number }
  entities: Entities; regions: OcrWord[]
  classification: { category: string; severity: string; tactics: string[] }
  visualSignals: VisualSignal[]; similar: SimilarHit[]
  deepAnalysisUsed: boolean; deepAnalysis?: string; cached?: boolean
}
type Stage = 'idle' | 'compressing' | 'analyzing' | 'done' | 'error'

const VERDICT_STYLE: Record<Verdict['verdict'], string> = {
  likely_scam: 'bg-red-500/15 text-red-300 border-red-500/40',
  suspicious: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  likely_safe: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  unclear: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
  needs_review: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
}
const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
// Feature flags (NEXT_PUBLIC_* are inlined at build). Default ON; set to the
// string "false" to disable in a given environment. (task 4)
const UPLOAD_ENABLED = process.env.NEXT_PUBLIC_UPLOAD_ENABLED !== 'false'
const GEO_ENABLED = process.env.NEXT_PUBLIC_GEO_ENABLED !== 'false'

// Client-side downscale + recompress → smaller upload → lower Vertex/OCR cost.
async function optimizeImage(file: File): Promise<{ dataUrl: string; mime: string }> {
  const original = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file) })
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = original })
    const maxDim = 1600
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    if (scale === 1 && file.size < 600_000) return { dataUrl: original, mime: file.type }
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d'); if (!ctx) return { dataUrl: original, mime: file.type }
    ctx.drawImage(img, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    return dataUrl.length < original.length ? { dataUrl, mime: 'image/jpeg' } : { dataUrl: original, mime: file.type }
  } catch { return { dataUrl: original, mime: file.type } }
}

export function ScreenshotAnalyzer({ defaultLang = 'en' as Lang }: { defaultLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(defaultLang)
  const [country, setCountry] = useState<CountryConfig>(getCountry())
  const [geo, setGeo] = useState<{ source: GeoSource; locale: string; headerCode: string | null }>({ source: 'fallback', locale: '', headerCode: null })
  const [preview, setPreview] = useState('')
  const [nat, setNat] = useState({ w: 1, h: 1 })
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Verdict | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const { user } = useAuth()
  const { quota, refresh } = useCredits()

  // Country detection: browser locale first, then CDN geo header (best-effort).
  // Gated by NEXT_PUBLIC_GEO_ENABLED. (task 4)
  useEffect(() => {
    if (!GEO_ENABLED) return
    const locale = navigator.language || ''
    const d = resolveCountryDetailed({ locale })
    setCountry(d.config); setGeo({ source: d.source, locale, headerCode: null })
    fetch('/api/geo').then((r) => r.json()).then((g) => {
      if (g.countryCode) { const d2 = resolveCountryDetailed({ geoHeader: g.countryCode, locale }); setCountry(d2.config); setGeo({ source: d2.source, locale, headerCode: g.countryCode }) }
    }).catch(() => {})
    if (/^hi/i.test(locale)) setLang('hinglish')
  }, [])

  const analyze = useCallback(async (file: File) => {
    setError(''); setResult(null)
    if (!ALLOWED.includes(file.type)) { setError('Please upload a PNG, JPEG, or WebP screenshot.'); setStage('error'); return }
    if (file.size > 6 * 1024 * 1024) { setError('Image too large (max 6 MB).'); setStage('error'); return }
    setStage('compressing')
    const { dataUrl, mime } = await optimizeImage(file)
    setPreview(dataUrl)
    setStage('analyzing')
    try {
      const r = await fetch('/api/scam-intel/screenshot', { method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(user) }, body: JSON.stringify({ imageBase64: dataUrl, mime }) })
      const data = await r.json()
      if (r.status === 402) { setError(data.detail || `Daily limit reached (${quota} credits; screenshots use 3). Sign in for 50/day.`); setStage('error'); void refresh(); return }
      if (!r.ok) { setError(data.detail || data.error || 'Analysis failed.'); setStage('error'); return }
      const v = data as Verdict
      setResult(v)
      // Refine country from phone numbers in the screenshot if found.
      if (GEO_ENABLED) {
        const refined = resolveCountryDetailed({ phones: v.entities?.phones, geoHeader: geo.headerCode, locale: geo.locale })
        setCountry(refined.config); setGeo((g) => ({ ...g, source: refined.source }))
      }
      setStage('done')
      void refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Network error.'); setStage('error') }
  }, [geo.headerCode, geo.locale, user, refresh, quota])

  // Paste-to-analyze (clipboard screenshot).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      const f = item?.getAsFile(); if (f) void analyze(f)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [analyze])

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) void analyze(f) }, [analyze])
  const pick = () => fileRef.current?.click()
  const scale = (imgRef.current?.clientWidth || nat.w) / nat.w
  const busy = stage === 'compressing' || stage === 'analyzing'

  return (
    <div className="text-zinc-100">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{t(lang, 'headline')}</h2>
        <div className="flex gap-1 text-xs">
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)} className={cn('rounded px-2 py-1', lang === l.code ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-300')}>{l.label}</button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-400">{t(lang, 'sub')}</p>

      {!UPLOAD_ENABLED && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">Screenshot upload is temporarily disabled. Please check back shortly.</div>
      )}

      {/* Primary, highly-visible upload CTA (always above the fold). */}
      {UPLOAD_ENABLED && (<>
      <button onClick={pick} aria-label={t(lang, 'ctaUpload')}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 active:scale-[0.99]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
        {t(lang, 'ctaUpload')}
      </button>

      {/* Secondary entry points (semantic, SEO + clarity). */}
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={pick} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500">{t(lang, 'ctaWhatsApp')}</button>
        <button onClick={pick} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500">{t(lang, 'ctaSms')}</button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} onClick={pick}
        className={cn('mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition', dragOver ? 'border-sky-400 bg-sky-500/10' : 'border-zinc-700 hover:border-zinc-500')}
      >
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void analyze(f) }} />
        <p className="text-sm text-zinc-300">{t(lang, 'dropzone')}</p>
        <p className="mt-1 text-xs text-zinc-500">{t(lang, 'formats')}</p>
      </div>
      </>)}

      {error && <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {busy && (
        <div className="mt-4 flex items-center gap-3 text-sm text-zinc-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-sky-400" />
          {t(lang, stage === 'compressing' ? 'compressing' : 'analyzing')}
        </div>
      )}

      {preview && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <div className="relative inline-block overflow-hidden rounded-lg border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={preview} alt="uploaded screenshot" className="max-w-full" onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })} />
              {result?.regions?.map((r, i) => (
                <span key={i} className="pointer-events-none absolute border-2 border-red-400/80 bg-red-500/20" style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }} />
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
                <div className="mt-1 text-xs opacity-80">Scam probability {Math.round(result.scamProbability * 100)}% · trust {result.trustScore}/100 · {result.classification.category.replace(/_/g, ' ')}{result.deepAnalysisUsed ? ' · deep vision' : ''}{result.cached ? ' · cached' : ''}</div>
                {result.explanation && <p className="mt-2 text-sm opacity-90">{result.explanation}</p>}
              </div>

              {result.safetyAdvice?.length > 0 && (
                <div><h3 className="mb-1 text-sm font-medium text-zinc-300">{t(lang, 'whatToDo')}</h3>
                  <ul className="list-inside list-disc space-y-1 text-sm text-zinc-300">{result.safetyAdvice.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}

              {result.entities && (result.entities.phones.length + result.entities.urls.length + result.entities.upiIds.length + result.entities.amounts.length > 0) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-zinc-300">{t(lang, 'extracted')}</h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {result.entities.urls.map((u, i) => <span key={`u${i}`} className={cn('rounded-full px-2 py-1', result.entities.shorteners.includes(u) ? 'bg-red-500/15 text-red-300' : 'bg-zinc-800 text-zinc-300')}>{u}</span>)}
                    {result.entities.upiIds.map((u, i) => <span key={`p${i}`} className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-300">{u}</span>)}
                    {result.entities.phones.map((p, i) => <span key={`ph${i}`} className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-300">📞 {p}</span>)}
                    {result.entities.amounts.map((a, i) => <span key={`a${i}`} className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-300">{a}</span>)}
                    {result.entities.qrPaymentRefs.length > 0 && <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-300">⚠ QR / collect request</span>}
                  </div>
                </div>
              )}

              {result.visualSignals.length > 0 && (
                <div><h3 className="mb-1 text-sm font-medium text-zinc-300">{t(lang, 'fraudSignals')}</h3>
                  <ul className="space-y-1">{result.visualSignals.map((s) => (
                    <li key={s.id} className="flex items-start gap-2 text-sm">
                      <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', s.severity === 'danger' ? 'bg-red-400' : s.severity === 'warn' ? 'bg-amber-400' : 'bg-zinc-400')} />
                      <span className="text-zinc-300">{s.label} <span className="text-zinc-500">— “{s.evidence}”</span></span>
                    </li>
                  ))}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {result && result.similar?.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-1 text-sm font-medium text-zinc-300">{t(lang, 'similar')}</h3>
          <ul className="space-y-1">{result.similar.map((s) => (
            <li key={s.id} className="text-sm"><span className="text-zinc-300">{s.title || s.id}</span><span className="ml-2 text-xs text-zinc-500">{s.confidenceBand} ({Math.round(s.confidence * 100)}%)</span></li>
          ))}</ul>
        </div>
      )}

      {/* Country-aware reporting (i18n + localization). */}
      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
        <h3 className="font-medium text-zinc-200">{t(lang, 'reportLabel')} — {country.name}</h3>
        <p className="mt-1 text-zinc-400">{country.bankingGuidance}</p>
        <p className="mt-1 text-zinc-300">{country.agency}: <span className="text-zinc-100">{country.helpline}</span></p>
        <a href={country.reportUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sky-400 hover:underline">{country.reportUrl.replace(/^https?:\/\//, '')}</a>
      </div>

      <p className="mt-3 text-xs text-zinc-500">{t(lang, 'disclaimer')} Images are optimized on your device and processed securely, not stored.</p>
    </div>
  )
}
