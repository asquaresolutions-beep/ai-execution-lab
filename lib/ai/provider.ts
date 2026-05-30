// ─────────────────────────────────────────────────────────────────
// lib/ai/provider.ts
// Vertex AI Gemini provider — dependency-free, interface-preserving.
//
// Design goals:
//  - Talks EXCLUSIVELY to Vertex AI (no direct Generative Language API).
//    Auth via OAuth bearer (service account / Workload Identity) — see
//    vertex-auth.ts. Native fetch only, no SDK.
//  - Model tiers: Gemini 2.5 Flash (fast/cheap, default) and Gemini 2.5
//    Pro (deep analysis). Callers pick via opts.tier / opts.deep.
//  - Automatic fallback + graceful rate-limit handling: retries with
//    backoff on 429/503, then falls back across tiers once.
//  - Token usage + cost estimation recorded on every live call.
//  - Offline-safe MockProvider keeps builds/tests/dev working unchanged.
//  - Backward compatible: getProvider(), generateJSON(), parseLooseJSON(),
//    setProvider(), AIProviderError, GenerateOptions all preserved.
// ─────────────────────────────────────────────────────────────────

import { getAccessToken, hasVertexAuth, serviceAccountProjectId } from './vertex-auth'
import { recordUsage, type ModelTier, type TokenUsage } from './usage'
import { log } from '@/lib/observability/logger'

export interface GenerateOptions {
  /** System / role instruction. */
  system?: string
  /** Sampling temperature (0 = deterministic). Default 0.7. */
  temperature?: number
  /** Hard cap on output tokens. */
  maxTokens?: number
  /** Ask the model to return strict JSON. */
  json?: boolean
  /** Model tier. Default 'flash'. */
  tier?: ModelTier
  /** Convenience: deep analysis → 'pro'. Overridden by explicit tier. */
  deep?: boolean
  /** Disable cross-tier fallback for this call. */
  noFallback?: boolean
}

export interface AIProvider {
  readonly name: string
  /** True when the provider can make real (billed) calls. */
  readonly live: boolean
  generate(prompt: string, opts?: GenerateOptions): Promise<string>
}

// ── Config ─────────────────────────────────────────────────────────
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1'
const PROJECT =
  process.env.VERTEX_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  serviceAccountProjectId()

const MODELS: Record<ModelTier, string> = {
  flash: process.env.VERTEX_FLASH_MODEL || 'gemini-2.5-flash',
  pro: process.env.VERTEX_PRO_MODEL || 'gemini-2.5-pro',
}

const MAX_RETRIES = 2
const RETRYABLE = new Set([429, 500, 502, 503, 504])

function vertexBase(): string {
  // 'global' uses the non-regional host.
  return LOCATION === 'global'
    ? 'https://aiplatform.googleapis.com'
    : `https://${LOCATION}-aiplatform.googleapis.com`
}

export function pickTier(opts: GenerateOptions = {}): ModelTier {
  return opts.tier ?? (opts.deep ? 'pro' : 'flash')
}

// ── Vertex provider ────────────────────────────────────────────────
class VertexProvider implements AIProvider {
  readonly name = `vertex:${MODELS.flash}/${MODELS.pro}@${LOCATION}`
  readonly live = true

  async generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    const tier = pickTier(opts)
    try {
      return await this.callWithRetry(tier, prompt, opts)
    } catch (err) {
      const status = (err as AIProviderError).status
      // Cross-tier fallback once: flash↔pro on persistent rate-limit/5xx.
      if (!opts.noFallback && RETRYABLE.has(status)) {
        const other: ModelTier = tier === 'flash' ? 'pro' : 'flash'
        log.warn({ event: 'ai.tier_fallback', from: tier, to: other, status })
        return this.callWithRetry(other, prompt, { ...opts, noFallback: true })
      }
      throw err
    }
  }

  private async callWithRetry(tier: ModelTier, prompt: string, opts: GenerateOptions): Promise<string> {
    let lastErr: AIProviderError | null = null
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.callOnce(tier, prompt, opts)
      } catch (err) {
        lastErr = err as AIProviderError
        if (!RETRYABLE.has(lastErr.status) || attempt === MAX_RETRIES) break
        // Exponential backoff with jitter (graceful rate-limit handling).
        const delay = Math.min(8000, 400 * 2 ** attempt) + Math.random() * 250
        log.warn({ event: 'ai.retry', tier, attempt: attempt + 1, status: lastErr.status, delayMs: Math.round(delay) })
        await sleep(delay)
      }
    }
    throw lastErr ?? new AIProviderError('Unknown AI error', 500)
  }

  private async callOnce(tier: ModelTier, prompt: string, opts: GenerateOptions): Promise<string> {
    if (!PROJECT) throw new AIProviderError('VERTEX_PROJECT_ID not configured', 500)
    const model = MODELS[tier]
    const token = await getAccessToken()
    const url = `${vertexBase()}/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxTokens ?? 2048,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    }
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new AIProviderError(`Vertex ${model} ${res.status}: ${detail.slice(0, 300)}`, res.status)
    }
    const data = (await res.json()) as VertexResponse
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? ''

    // Token usage + cost (best-effort).
    if (data.usageMetadata) {
      const usage: TokenUsage = {
        promptTokens: data.usageMetadata.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata.totalTokenCount ?? 0,
      }
      await recordUsage(model, tier, usage)
    }

    if (!text) throw new AIProviderError('Empty completion from Vertex', 502)
    return text
  }
}

// ── Deterministic offline mock ─────────────────────────────────────
class MockProvider implements AIProvider {
  readonly name = 'mock'
  readonly live = false

  async generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    if (opts.json) {
      return JSON.stringify({
        _mock: true,
        note: 'MockProvider output — configure Vertex AI for live generation.',
        tier: pickTier(opts),
        echo: prompt.slice(0, 120),
      })
    }
    const seed = prompt.slice(0, 80).replace(/\s+/g, ' ').trim()
    return `[mock:${pickTier(opts)}] ${seed}\n\n(Configure Vertex AI to enable live generation.)`
  }
}

export class AIProviderError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'AIProviderError'
    this.status = status
  }
}

interface VertexResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
}

// ── Factory ────────────────────────────────────────────────────────
let _provider: AIProvider | null = null

export function vertexConfigured(): boolean {
  return hasVertexAuth() && !!PROJECT
}

export function getProvider(): AIProvider {
  if (_provider) return _provider
  _provider = vertexConfigured() ? new VertexProvider() : new MockProvider()
  return _provider
}

/** Test/override hook — inject a custom provider. */
export function setProvider(p: AIProvider | null): void {
  _provider = p
}

// ── JSON helper ────────────────────────────────────────────────────
export async function generateJSON<T = unknown>(prompt: string, opts: GenerateOptions = {}): Promise<T> {
  const raw = await getProvider().generate(prompt, { ...opts, json: true })
  return parseLooseJSON<T>(raw)
}

export function parseLooseJSON<T = unknown>(raw: string): T {
  const cleaned = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/)
    if (match) return JSON.parse(match[0]) as T
    throw new AIProviderError('Model did not return valid JSON', 502)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
