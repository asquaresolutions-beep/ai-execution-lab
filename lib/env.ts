// ─────────────────────────────────────────────────────────────────
// lib/env.ts
// Centralised environment access + production validation.
//
// - `env` gives typed, defaulted access to every variable the engines use.
// - `validateProductionEnv()` returns a structured report (never throws at
//   import time) so /api/health and the analytics dashboard can surface
//   exactly what is configured and what is missing.
// - `mode()` reports whether AI is live and where data persists.
// ─────────────────────────────────────────────────────────────────

function str(key: string, fallback = ''): string {
  return (process.env[key] ?? fallback).trim()
}

export const env = {
  // Core
  siteUrl: str('NEXT_PUBLIC_SITE_URL', 'https://lab.asquaresolution.com'),
  nodeEnv: str('NODE_ENV', 'development'),

  // AI — Vertex AI Gemini
  vertexProjectId: str('VERTEX_PROJECT_ID') || str('FIREBASE_PROJECT_ID'),
  vertexLocation: str('VERTEX_LOCATION', 'us-central1'),
  vertexAccessToken: str('VERTEX_ACCESS_TOKEN'),
  serviceAccountJson: str('GOOGLE_SERVICE_ACCOUNT_JSON') || str('GCP_SERVICE_ACCOUNT_KEY'),
  vertexFlashModel: str('VERTEX_FLASH_MODEL', 'gemini-2.5-flash'),
  vertexProModel: str('VERTEX_PRO_MODEL', 'gemini-2.5-pro'),
  vertexEmbedModel: str('VERTEX_EMBED_MODEL', 'text-multilingual-embedding-002'),

  // Firestore
  firebaseProjectId: str('FIREBASE_PROJECT_ID'),
  firebaseApiKey: str('FIREBASE_API_KEY'),
  firebaseAccessToken: str('FIREBASE_ACCESS_TOKEN'),
  firebaseDatabaseId: str('FIREBASE_DATABASE_ID', '(default)'),

  // Auth / security
  adminApiToken: str('ADMIN_API_TOKEN'),
  cronSecret: str('CRON_SECRET'),

  // Ops
  storeFile: str('STORE_FILE'),
  logLevel: str('LOG_LEVEL', 'info'),
} as const

export interface EnvCheck {
  key: string
  present: boolean
  required: boolean
  note: string
}

export interface EnvReport {
  ok: boolean              // all required present
  aiLive: boolean
  persistence: 'firestore' | 'memory'
  checks: EnvCheck[]
  missingRequired: string[]
  warnings: string[]
}

/**
 * Validate environment for PRODUCTION live mode. Required = the minimum to
 * run live (AI + Firestore + admin + cron auth). Optional vars produce
 * warnings, not failures.
 */
export function validateProductionEnv(): EnvReport {
  // ADC: on Cloud Run / GCE the attached service account provides auth via
  // the metadata server — no explicit token/key needed.
  const adc = !!(process.env.K_SERVICE || process.env.K_REVISION || process.env.FUNCTION_TARGET || process.env.GAE_SERVICE || process.env.GCE_METADATA_HOST || process.env.USE_ADC)
  const vertexAuth = !!(env.vertexAccessToken || env.serviceAccountJson) || adc
  const checks: EnvCheck[] = [
    { key: 'VERTEX_PROJECT_ID (or FIREBASE_PROJECT_ID)', present: !!env.vertexProjectId, required: true, note: 'Vertex AI project for Gemini' },
    { key: 'VERTEX auth (token / service account / Cloud Run ADC)', present: vertexAuth, required: true, note: 'Vertex AI auth — explicit token, SA key, or attached service account (ADC)' },
    { key: 'FIREBASE_PROJECT_ID', present: !!env.firebaseProjectId, required: true, note: 'Firestore project' },
    { key: 'FIREBASE_API_KEY / FIREBASE_ACCESS_TOKEN', present: !!(env.firebaseApiKey || env.firebaseAccessToken), required: true, note: 'Firestore auth (API key or service-account token)' },
    { key: 'ADMIN_API_TOKEN', present: !!env.adminApiToken, required: true, note: 'Gates admin routes + dashboards data' },
    { key: 'CRON_SECRET', present: !!env.cronSecret, required: true, note: 'Authenticates Vercel cron invocations' },
    { key: 'NEXT_PUBLIC_SITE_URL', present: !!env.siteUrl, required: true, note: 'Canonical URLs + schema' },
    { key: 'VERTEX_LOCATION', present: !!env.vertexLocation, required: false, note: 'Defaults to us-central1' },
    { key: 'VERTEX_FLASH_MODEL', present: !!env.vertexFlashModel, required: false, note: 'Defaults to gemini-2.5-flash' },
    { key: 'VERTEX_PRO_MODEL', present: !!env.vertexProModel, required: false, note: 'Defaults to gemini-2.5-pro' },
  ]

  const missingRequired = checks.filter((c) => c.required && !c.present).map((c) => c.key)
  const warnings: string[] = []
  if (env.vertexAccessToken && env.serviceAccountJson) {
    warnings.push('Both VERTEX_ACCESS_TOKEN and service account set — access token takes precedence.')
  }
  if (env.firebaseApiKey && env.firebaseAccessToken) {
    warnings.push('Both FIREBASE_API_KEY and FIREBASE_ACCESS_TOKEN set — access token takes precedence.')
  }
  if (env.storeFile && env.firebaseProjectId) {
    warnings.push('STORE_FILE is ignored when Firestore is configured.')
  }

  return {
    ok: missingRequired.length === 0,
    // Live when we have auth AND a project source (env OR Cloud Run ADC, where
    // the project is resolved from the metadata server at call time).
    aiLive: vertexAuth && (!!env.vertexProjectId || adc),
    persistence: env.firebaseProjectId && (env.firebaseApiKey || env.firebaseAccessToken) ? 'firestore' : 'memory',
    checks,
    missingRequired,
    warnings,
  }
}

export function mode(): { aiLive: boolean; persistence: 'firestore' | 'memory' } {
  const r = validateProductionEnv()
  return { aiLive: r.aiLive, persistence: r.persistence }
}
