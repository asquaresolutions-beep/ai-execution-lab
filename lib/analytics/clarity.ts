// lib/analytics/clarity.ts
// Decision logic for Microsoft Clarity. No imports and no global DOM access — the page objects
// are passed in — so it is unit-testable in Node.
//
// One deployment serves three hosts, so the Clarity project follows the hostname the
// visitor actually sees — never the route path (lab.* also serves /trustseal/* and
// ScamCheck routes). Any host not in the allowlist (*.vercel.app, previews, localhost,
// unknown domains) gets no Clarity at all.

export const CLARITY_TAGS: Readonly<Record<string, string>> = Object.freeze({
  'trustseal.asquaresolution.com': 'yiorq9r173',
  'scamcheck.asquaresolution.com': 'yisc9590xj',
  'lab.asquaresolution.com': 'yiscisont7',
})

// Same key the consent banner writes: { analytics: boolean, ads: boolean, ts }.
export const CONSENT_STORAGE_KEY = 'sc-consent-v1'

export type ConsentValue = 'granted' | 'denied'
export interface ClarityConsent { ad_Storage: ConsentValue; analytics_Storage: ConsentValue }
export interface StoredConsent { analytics: boolean; ads: boolean }

export function clarityTagFor(
  hostname: string,
  pathname: string,
  env: { nodeEnv?: string; vercelEnv?: string },
): string | null {
  if (env.nodeEnv !== 'production') return null
  // Vercel exposes the deployment environment; anything other than production is skipped.
  if (env.vercelEnv && env.vercelEnv !== 'production') return null
  // /embed/* is iframed inside WordPress articles, which have their own Clarity project.
  if (pathname === '/embed' || pathname.startsWith('/embed/')) return null
  return Object.prototype.hasOwnProperty.call(CLARITY_TAGS, hostname) ? CLARITY_TAGS[hostname] : null
}

export function parseStoredConsent(raw: string | null): StoredConsent | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as { analytics?: unknown; ads?: unknown } | null
    if (!v || typeof v !== 'object') return null
    return { analytics: v.analytics === true, ads: v.ads === true }
  } catch {
    return null
  }
}

// No stored choice → denied for both, matching the Google Consent Mode default in app/layout.tsx.
export function clarityConsentFrom(prefs: StoredConsent | null): ClarityConsent {
  return {
    ad_Storage: prefs?.ads === true ? 'granted' : 'denied',
    analytics_Storage: prefs?.analytics === true ? 'granted' : 'denied',
  }
}

export const CLARITY_SCRIPT_ID = 'ms-clarity-tag'

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] }
export interface ClarityContext {
  hostname: string
  pathname: string
  env: { nodeEnv?: string; vercelEnv?: string }
  win: { clarity?: ClarityFn }
  doc: Pick<Document, 'getElementById' | 'createElement' | 'head'>
}

// Consent gate. The hosts share the asquaresolution.com root domain, and Clarity keeps its
// _clck/_clsk cookies there, so Clarity must not run at all on a host where analytics consent
// hasn't been granted — otherwise it picks up identity set on another subdomain.
//   • tag already on the page → forward the current choice via Consent API v2 (grant or withdraw)
//   • not loaded, analytics not granted → do nothing (no script, no queue, no Clarity calls)
//   • not loaded, analytics granted, allowlisted host → queue consentv2, then add the tag once
export function syncClarity(prefs: StoredConsent | null, ctx: ClarityContext): 'updated' | 'loaded' | 'skipped' {
  if (ctx.doc.getElementById(CLARITY_SCRIPT_ID)) {
    if (typeof ctx.win.clarity !== 'function') return 'skipped'
    ctx.win.clarity('consentv2', clarityConsentFrom(prefs))
    return 'updated'
  }
  if (prefs?.analytics !== true) return 'skipped'
  const tag = clarityTagFor(ctx.hostname, ctx.pathname, ctx.env)
  if (!tag) return 'skipped'

  // Command queue from Microsoft's install snippet; calls made before the tag loads are replayed.
  if (typeof ctx.win.clarity !== 'function') {
    const queue: ClarityFn = function () {
      // eslint-disable-next-line prefer-rest-params
      ;(queue.q = queue.q || []).push(arguments)
    }
    ctx.win.clarity = queue
  }
  ctx.win.clarity('consentv2', clarityConsentFrom(prefs))

  const script = ctx.doc.createElement('script')
  script.id = CLARITY_SCRIPT_ID
  script.async = true
  script.src = `https://www.clarity.ms/tag/${tag}`
  ctx.doc.head.appendChild(script)
  return 'loaded'
}
