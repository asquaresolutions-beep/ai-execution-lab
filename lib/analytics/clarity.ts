// lib/analytics/clarity.ts
// Pure decision logic for Microsoft Clarity (no DOM access, so it is unit-testable).
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
