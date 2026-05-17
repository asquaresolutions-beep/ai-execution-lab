/**
 * /api/vitals — Web Vitals collection endpoint.
 *
 * Receives Core Web Vitals beacons from the WebVitals component via
 * navigator.sendBeacon(). Returns 204 No Content so the beacon
 * completes cleanly in production.
 *
 * To forward vitals to an analytics backend, parse the body here:
 *
 *   const data = await req.json()
 *   // data: { name: 'LCP', value: 1240, rating: 'good', id: '...' }
 *
 * Current behaviour: accept and acknowledge. Extend as needed.
 */
export async function POST() {
  // Accept the beacon — no processing needed unless forwarding to analytics
  return new Response(null, { status: 204 })
}
