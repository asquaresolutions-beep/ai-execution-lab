'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useAuth } from './auth-provider'
import {
  errorCode, errorLabelKey, googleUiReducer, initialGoogleUiState, isRetryable,
  loadGoogleIdentity, renderGoogleButton,
} from '@/lib/auth/google-signin'

interface AuthLabels {
  signIn?: string; signOut?: string; greeting?: string
  continueGoogle?: string
  notConfigured?: string; googleFailed?: string
  googleLoading?: string; googleSigningIn?: string
  googleUnavailable?: string; googleTimeout?: string; tryAgain?: string
}

const DEFAULTS: Required<AuthLabels> = {
  signIn: 'Sign in', signOut: 'Sign out', greeting: 'Hi',
  continueGoogle: 'Continue with Google',
  notConfigured: 'Auth not configured yet.',
  googleFailed: 'Google sign-in failed. Please try again.',
  googleLoading: 'Loading Google sign-in…',
  googleSigningIn: 'Signing you in…',
  googleUnavailable: 'Google sign-in couldn’t load. Check your connection or any ad/tracker blocker, then try again.',
  googleTimeout: 'Google sign-in is taking too long. Please try again.',
  tryAgain: 'Try again',
}

const BUTTON_WIDTH = 256 // fits the w-72 panel (288px − 2×16px padding)

// Google's rendered "Continue with Google" button (popup mode). Every async step is
// bounded (see lib/auth/google-signin.ts), so the panel always ends on a clickable
// button, a success, or a visible error — never a permanently disabled control.
function GoogleSignIn({ labels, locale, onSignedIn }: { labels?: AuthLabels; locale?: string; onSignedIn: () => void }) {
  const { configured, googleClientId, signInWithGoogleCredential } = useAuth()
  const available = configured && !!googleClientId
  const [state, dispatch] = useReducer(googleUiReducer, available, initialGoogleUiState)
  const [attempt, setAttempt] = useState(0)
  const slot = useRef<HTMLDivElement>(null)
  // Latest callbacks without re-rendering Google's button on every parent render.
  const exchangeRef = useRef(signInWithGoogleCredential)
  const signedInRef = useRef(onSignedIn)
  exchangeRef.current = signInWithGoogleCredential
  signedInRef.current = onSignedIn
  const L = (k: keyof AuthLabels) => labels?.[k] ?? DEFAULTS[k]

  useEffect(() => {
    if (!available) return
    let cancelled = false
    loadGoogleIdentity()
      .then((gis) => {
        if (cancelled || !slot.current) return
        renderGoogleButton(gis, slot.current, {
          clientId: googleClientId,
          locale,
          width: BUTTON_WIDTH,
          onCredential: (credential) => {
            dispatch({ type: 'credential' })
            exchangeRef.current(credential)
              .then(() => { dispatch({ type: 'signed_in' }); signedInRef.current() })
              .catch((e) => {
                console.warn('[auth] Google sign-in failed:', errorCode(e)) // code only — never the credential
                dispatch({ type: 'fail', code: errorCode(e) })
              })
          },
        })
        dispatch({ type: 'loaded' })
      })
      .catch((e) => { if (!cancelled) dispatch({ type: 'fail', code: errorCode(e) }) })
    return () => { cancelled = true }
  }, [available, googleClientId, locale, attempt])

  const retry = () => { dispatch({ type: 'retry' }); setAttempt((n) => n + 1) }
  const showButton = state.phase === 'loading' || state.phase === 'ready'

  return (
    <div>
      {state.phase === 'loading' && <p role="status" className="mb-2 text-center text-xs text-zinc-400">{L('googleLoading')}</p>}
      {state.phase === 'exchanging' && <p role="status" className="py-3 text-center text-sm text-zinc-300">{L('googleSigningIn')}</p>}
      <div ref={slot} aria-label={L('continueGoogle')} className={showButton ? 'flex min-h-[40px] justify-center' : 'hidden'} />
      {state.phase === 'error' && (
        <div role="alert" className={`rounded-lg p-2 text-xs ${state.code === 'not_configured' ? 'bg-amber-500/10 text-amber-300' : 'bg-red-500/10 text-red-300'}`}>
          <p>{L(errorLabelKey(state.code))}</p>
          {isRetryable(state) && (
            <button type="button" onClick={retry} className="mt-2 w-full rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-500">
              {L('tryAgain')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function AuthButton({ labels, locale }: { labels?: AuthLabels; locale?: string } = {}) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const L = (k: keyof AuthLabels) => labels?.[k] ?? DEFAULTS[k]

  if (user) return (
    <div className="flex items-center gap-2 text-sm">
      <span data-clarity-mask="True" className="text-zinc-400">{L('greeting')}, {user.name}</span>
      <button onClick={signOut} className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500">{L('signOut')}</button>
    </div>
  )

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700">{L('signIn')}</button>
      {open && (
        <div className="absolute end-0 z-20 mt-2 w-72 rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
          <GoogleSignIn labels={labels} locale={locale} onSignedIn={close} />
        </div>
      )}
    </div>
  )
}
