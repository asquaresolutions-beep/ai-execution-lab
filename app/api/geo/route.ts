// GET /api/geo  (PUBLIC) — best-effort country detection from CDN geo headers.
// Cloud Run alone doesn't geolocate; behind a CDN (Vercel/Cloudflare) these
// headers are populated. Falls back to null so the client uses browser locale.
import { NextResponse } from 'next/server'
import { getCountry } from '@/lib/scam-intel/countries'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

export const GET = jsonRoute('geo', async (req) => {
  const h = req.headers
  const code = h.get('x-vercel-ip-country') || h.get('cf-ipcountry') || h.get('x-country-code') || null
  const country = code ? getCountry(code) : null
  return NextResponse.json({ countryCode: country?.code ?? null, country }, { headers: { 'Cache-Control': 'private, max-age=300' } })
})
