// ─────────────────────────────────────────────────────────────────
// lib/auth/google-signin.ts
// Framework-free core of the "Sign in with Google" flow, shared by ScamCheck and
// TrustSeal via components/auth. Kept free of React and of @/ imports so every
// path — including the failure paths — is unit-tested under plain Node.
//
// Why this exists: the previous flow awaited google.accounts.id.prompt() (One Tap).
// One Tap is a passive prompt that Google/the browser may simply not show (no Google
// session, cooldown after a dismissal, third-party sign-in blocked, unsupported
// browser), and in that case no callback ever fires — the awaiting UI stayed
// disabled forever. This module replaces it with Google's RENDERED button (popup
// mode), which the user clicks explicitly, and bounds every asynchronous step with a
// timeout so an attempt always ends in success or a visible error.
//
// The session model is unchanged: the Google ID token is exchanged for a Firebase
// session by the caller-supplied `exchange` (lib/auth/firebase.ts).
// ─────────────────────────────────────────────────────────────────

export const GIS_SRC = 'https://accounts.google.com/gsi/client'
export const GIS_SCRIPT_ID = 'gsi-client'
export const GIS_LOAD_TIMEOUT_MS = 10_000
export const EXCHANGE_TIMEOUT_MS = 20_000

export type GoogleSignInErrorCode =
  | 'not_configured'    // no Google client id / Firebase key in this build
  | 'script_failed'     // the Google script could not load (network, blocker, CSP)
  | 'script_timeout'    // the Google script did not finish loading in time
  | 'unavailable'       // script loaded but the Google Identity API is missing
  | 'no_credential'     // Google returned without an ID token
  | 'exchange_timeout'  // creating the session took too long
  | 'exchange_failed'   // the session exchange was rejected or the network failed

export class GoogleSignInError extends Error {
  readonly code: GoogleSignInErrorCode
  constructor(code: GoogleSignInErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'GoogleSignInError'
    this.code = code
  }
}

export function errorCode(e: unknown): GoogleSignInErrorCode {
  return e instanceof GoogleSignInError ? e.code : 'exchange_failed'
}

// ── Minimal typings for the parts of Google Identity Services we use ──
export interface GisCredentialResponse { credential?: string }
export interface GisButtonOptions {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
  click_listener?: () => void
}
export interface GisId {
  initialize(options: { client_id: string; callback: (r: GisCredentialResponse) => void; ux_mode?: 'popup' | 'redirect'; auto_select?: boolean }): void
  renderButton(parent: HTMLElement, options: GisButtonOptions): void
}
interface GisWindow { google?: { accounts?: { id?: GisId } } }

/** The Google Identity API on `win`, if it is present and usable. */
export function getGis(win: unknown): GisId | null {
  const id = (win as GisWindow | undefined)?.google?.accounts?.id
  return id && typeof id.initialize === 'function' && typeof id.renderButton === 'function' ? id : null
}

// ── Script loading: one shared attempt per page; a failed attempt can be retried ──
let loading: Promise<GisId> | null = null

export interface LoadOptions { doc?: Document; win?: unknown; timeoutMs?: number }

export function loadGoogleIdentity(opts: LoadOptions = {}): Promise<GisId> {
  const win = opts.win ?? (typeof window !== 'undefined' ? window : undefined)
  const doc = opts.doc ?? (typeof document !== 'undefined' ? document : undefined)
  const ready = getGis(win)
  if (ready) return Promise.resolve(ready)
  if (loading) return loading
  if (!doc) return Promise.reject(new GoogleSignInError('unavailable', 'no document'))

  const attempt = new Promise<GisId>((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => { if (!settled) { settled = true; clearTimeout(timer); fn() } }
    const timer = setTimeout(() => finish(() => reject(new GoogleSignInError('script_timeout'))), opts.timeoutMs ?? GIS_LOAD_TIMEOUT_MS)

    // A previous tag that already failed would never fire again — replace it.
    const stale = doc.getElementById(GIS_SCRIPT_ID)
    if (stale) stale.remove()

    const s = doc.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.defer = true
    s.id = GIS_SCRIPT_ID
    s.onload = () => finish(() => {
      const gis = getGis(win)
      if (gis) resolve(gis)
      else reject(new GoogleSignInError('unavailable'))
    })
    s.onerror = () => finish(() => reject(new GoogleSignInError('script_failed')))
    doc.head.appendChild(s)
  })

  loading = attempt
  // Only a successful load is cached; after a failure the next call starts over.
  attempt.catch(() => { if (loading === attempt) loading = null })
  return attempt
}

/** Test hook: forget any cached load and routing state. */
export function resetGoogleSignInForTests(): void {
  loading = null
  initializedClientId = null
  activeHandler = null
}

// ── Button rendering + credential routing ──
// GIS allows a single initialize() per page, but a page can show more than one
// sign-in button (e.g. ScamCheck's account page: header + body). The one page-level
// callback therefore forwards the credential to the handler of the button the user
// last clicked (click_listener), falling back to the most recently rendered one.
// The handler is deliberately NOT cleared when a button unmounts: if the user closes
// the menu while Google's popup is still open, the sign-in must still complete.
type CredentialHandler = (credential: string | undefined) => void
let initializedClientId: string | null = null
let activeHandler: CredentialHandler | null = null

export interface RenderOptions {
  clientId: string
  onCredential: CredentialHandler
  locale?: string
  width?: number
  theme?: GisButtonOptions['theme']
}

export function renderGoogleButton(gis: GisId, parent: HTMLElement, o: RenderOptions): void {
  if (initializedClientId !== o.clientId) {
    gis.initialize({
      client_id: o.clientId,
      ux_mode: 'popup',
      auto_select: false,
      callback: (r) => { activeHandler?.(r?.credential) },
    })
    initializedClientId = o.clientId
  }
  activeHandler = o.onCredential
  parent.innerHTML = '' // React StrictMode/dev re-runs effects — never stack two buttons
  gis.renderButton(parent, {
    type: 'standard',
    theme: o.theme ?? 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width: o.width,
    locale: o.locale,
    click_listener: () => { activeHandler = o.onCredential },
  })
}

// ── Credential → session exchange, bounded by a timeout ──
export type Exchange<U> = (idToken: string, signal: AbortSignal) => Promise<U>

export async function exchangeGoogleCredential<U>(credential: string | undefined, exchange: Exchange<U>, timeoutMs = EXCHANGE_TIMEOUT_MS): Promise<U> {
  if (!credential) throw new GoogleSignInError('no_credential')
  const ac = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { ac.abort(); reject(new GoogleSignInError('exchange_timeout')) }, timeoutMs)
  })
  try {
    return await Promise.race([exchange(credential, ac.signal), timeout])
  } catch (e) {
    if (e instanceof GoogleSignInError) throw e
    throw new GoogleSignInError('exchange_failed', e instanceof Error ? e.message : undefined)
  } finally {
    clearTimeout(timer)
  }
}

// ── UI state machine (what the sign-in panel shows) ──
// Invariant, asserted in tests: from every state, every event lands in either an
// interactive state (a clickable Google button, or an error with a retry/explanation)
// or a transient state whose exit is guaranteed by a timeout above.
export type GoogleUiState =
  | { phase: 'loading' }     // loading the Google script (bounded by GIS_LOAD_TIMEOUT_MS)
  | { phase: 'ready' }       // Google button rendered and clickable
  | { phase: 'exchanging' }  // credential received, creating the session (bounded by EXCHANGE_TIMEOUT_MS)
  | { phase: 'error'; code: GoogleSignInErrorCode }

export type GoogleUiEvent =
  | { type: 'loaded' }
  | { type: 'credential' }
  | { type: 'signed_in' }
  | { type: 'fail'; code: GoogleSignInErrorCode }
  | { type: 'retry' }

export function initialGoogleUiState(configured: boolean): GoogleUiState {
  return configured ? { phase: 'loading' } : { phase: 'error', code: 'not_configured' }
}

export function googleUiReducer(s: GoogleUiState, e: GoogleUiEvent): GoogleUiState {
  switch (e.type) {
    case 'loaded': return s.phase === 'loading' ? { phase: 'ready' } : s
    case 'credential': return { phase: 'exchanging' }
    case 'signed_in': return { phase: 'ready' }
    case 'fail': return { phase: 'error', code: e.code }
    case 'retry':
      if (s.phase === 'error' && s.code === 'not_configured') return s
      return s.phase === 'error' ? { phase: 'loading' } : s
  }
}

/** Transient phases always end by themselves (success or a timeout error). */
export function isTransient(s: GoogleUiState): boolean {
  return s.phase === 'loading' || s.phase === 'exchanging'
}

/** Does this error state offer "Try again"? (Configuration errors don't.) */
export function isRetryable(s: GoogleUiState): boolean {
  return s.phase === 'error' && s.code !== 'not_configured'
}

/** Label key for a user-visible message, per error code. */
export function errorLabelKey(code: GoogleSignInErrorCode): 'notConfigured' | 'googleUnavailable' | 'googleTimeout' | 'googleFailed' {
  switch (code) {
    case 'not_configured': return 'notConfigured'
    case 'script_failed':
    case 'unavailable': return 'googleUnavailable'
    case 'script_timeout':
    case 'exchange_timeout': return 'googleTimeout'
    default: return 'googleFailed'
  }
}
