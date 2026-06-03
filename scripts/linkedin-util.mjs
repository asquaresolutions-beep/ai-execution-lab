#!/usr/bin/env node
/**
 * scripts/linkedin-util.mjs
 *
 * Reusable LinkedIn publishing utility for AI Execution Lab operational posts.
 *
 * Reads LINKEDIN_ACCESS_TOKEN from .env.local only.
 * Never reads from process arguments, hardcoded values, or chat input.
 *
 * Usage (import in other scripts):
 *   import { loadToken, getProfile, publishPost } from './linkedin-util.mjs'
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')

// ─────────────────────────────────────────────────────────────────────────────
// .env.local reader (no external dependencies)
// ─────────────────────────────────────────────────────────────────────────────

export function loadEnv() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error(
      '[linkedin-util] .env.local not found.\n' +
      'Create it with:\n  LINKEDIN_ACCESS_TOKEN=your_token_here\n' +
      'Never paste the token anywhere else.'
    )
  }
  const raw = fs.readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key   = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    env[key] = value
  }
  return env
}

export function loadToken() {
  const env = loadEnv()
  const token = env.LINKEDIN_ACCESS_TOKEN
  if (!token || token.trim() === '') {
    throw new Error(
      '[linkedin-util] LINKEDIN_ACCESS_TOKEN is not set in .env.local.\n' +
      'Add it:\n  LINKEDIN_ACCESS_TOKEN=your_token_here'
    )
  }
  if (token.length < 50) {
    throw new Error(
      '[linkedin-util] LINKEDIN_ACCESS_TOKEN looks too short — verify it is a full OAuth 2.0 access token.'
    )
  }
  return token
}

// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn API helpers
// ─────────────────────────────────────────────────────────────────────────────

const LINKEDIN_API = 'https://api.linkedin.com'

// Required by LinkedIn versioned REST API (2023+)
// Without this header, calls return ACCESS_DENIED: *.NO_VERSION
const LINKEDIN_VERSION = '202405'

function baseHeaders(token) {
  return {
    'Authorization':               `Bearer ${token}`,
    'LinkedIn-Version':            LINKEDIN_VERSION,
    'X-Restli-Protocol-Version':   '2.0.0',
  }
}

/**
 * Validate token and return profile data including person URN.
 *
 * Resolution order:
 *   1. GET /v2/userinfo  (OpenID Connect — returns sub, name, given_name, family_name)
 *      Works with the versioned API and does not require X-Restli-Protocol-Version.
 *   2. GET /v2/me        (fallback, versioned header required since 2023)
 *
 * The person URN required for UGC post authorship is urn:li:person:{sub}.
 */
export async function getProfile(token) {
  // Primary: /v2/userinfo (OpenID Connect — most stable across API versions)
  const infoRes = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
    headers: baseHeaders(token),
  })

  if (infoRes.status === 401) {
    throw new Error(
      '[linkedin-util] Token is expired or invalid (401).\n' +
      'Revoke and regenerate your access token, then update .env.local.'
    )
  }

  if (infoRes.ok) {
    const info = await infoRes.json()
    const personId = info.sub
    if (!personId) {
      throw new Error('[linkedin-util] /v2/userinfo returned no sub field — token may lack r_liteprofile scope.')
    }
    const displayName =
      `${info.given_name ?? ''} ${info.family_name ?? ''}`.trim() ||
      info.name ||
      personId

    return {
      personId,
      authorUrn:   `urn:li:person:${personId}`,
      displayName,
    }
  }

  // Fallback: /v2/me with versioned headers
  const meRes = await fetch(`${LINKEDIN_API}/v2/me`, {
    headers: baseHeaders(token),
  })

  if (meRes.status === 401) {
    throw new Error(
      '[linkedin-util] Token is expired or invalid (401).\n' +
      'Revoke and regenerate your access token, then update .env.local.'
    )
  }
  if (!meRes.ok) {
    const body = await meRes.text()
    throw new Error(`[linkedin-util] Profile fetch failed (${meRes.status}): ${body}`)
  }

  const me = await meRes.json()
  const personId = me.id ?? me.sub
  if (!personId) {
    throw new Error('[linkedin-util] Could not extract person ID from profile response.')
  }

  return {
    personId,
    authorUrn:   `urn:li:person:${personId}`,
    displayName: personId,   // /v2/me v2 does not return display name
  }
}

/**
 * Publish a text post to LinkedIn.
 * Returns the post URN and constructed post URL.
 */
export async function publishPost(token, authorUrn, text) {
  const body = {
    author:         authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary:    { text },
        shareMediaCategory: 'NONE',
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  }

  const res = await fetch(`${LINKEDIN_API}/v2/ugcPosts`, {
    method:  'POST',
    headers: {
      ...baseHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`[linkedin-util] Post failed (${res.status}): ${errBody}`)
  }

  // LinkedIn returns the post URN in the x-restli-id header
  const postUrn = res.headers.get('x-restli-id') ?? res.headers.get('X-RestLi-Id')
  let postId = ''

  if (postUrn) {
    // URN format: urn:li:ugcPost:1234567890
    postId = postUrn.split(':').pop() ?? ''
  } else {
    // Try to read from body
    try {
      const json = await res.json()
      postId = json.id ?? ''
    } catch {
      // If we get here, post succeeded but we couldn't extract the ID
    }
  }

  const postUrl = postId
    ? `https://www.linkedin.com/feed/update/urn:li:ugcPost:${postId}/`
    : 'https://www.linkedin.com/feed/ (check your feed for the post)'

  return { postUrn, postId, postUrl }
}

/**
 * Validate a token without posting anything.
 * Returns profile data or throws on failure.
 */
export async function validateToken(token) {
  return getProfile(token)
}
