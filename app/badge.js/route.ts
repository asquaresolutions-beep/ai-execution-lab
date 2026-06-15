// GET /badge.js — public, friendly alias for the TrustSeal badge loader.
// The documented embed is:
//   <script src="https://trustseal.asquaresolution.com/badge.js" data-domain="acme.com"></script>
// It serves the exact same loader as /api/trustseal/badge.js (the loader
// self-locates via the '/badge.js' substring, which matches both paths), so the
// anti-forgery guarantees (live status fetch + origin-binding + Pro-gating) are
// identical. Kept as a thin re-export to avoid drift.
export { GET, dynamic } from '@/app/api/trustseal/badge.js/route'
