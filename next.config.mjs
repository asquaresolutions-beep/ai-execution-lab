/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow MDX files to be imported as pages in future if needed
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],

  // Strict mode — catch problems early
  reactStrictMode: true,

  // Don't expose Next.js version header in production
  poweredByHeader: false,

  // Ensure content MDX files are bundled with the dynamic search API function.
  // Without this, Vercel's output file tracing may omit ./content/** from the
  // serverless function bundle (since the path is computed at runtime via process.cwd()).
  outputFileTracingIncludes: {
    '/api/search': ['./content/**/*'],
    // The TrustSeal verify/report functions pull in normalize.ts, which loads the
    // vendored Public Suffix List via `new URL('./public_suffix_list.dat', import.meta.url)`.
    // Ensure that data file ships in the serverless bundle.
    '/api/trustseal/**': ['./lib/trustseal/verify/public_suffix_list.dat'],
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'asquaresolution.com',
      },
      {
        protocol: 'https',
        hostname: 'lab.asquaresolution.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com', // YouTube thumbnails
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Strip console.log in production builds only (keep error/warn).
  // Note: removeConsole only accepts true or { exclude } — never false.
  // Wrap in conditional to avoid applying it in dev.
  ...(process.env.NODE_ENV === 'production' && {
    compiler: {
      removeConsole: { exclude: ['error', 'warn'] },
    },
  }),

  // Security & caching headers
  async headers() {
    // Content-Security-Policy — compatible with everything the three products load:
    // Firebase Auth (apis.google.com / gstatic / *.firebaseapp.com auth iframe /
    // *.googleapis.com), Razorpay checkout (*.razorpay.com), Google AdSense +
    // GA/Plausible/Vercel analytics, and Next's inline runtime + our inline
    // consent/JSON-LD scripts. 'unsafe-inline'/'unsafe-eval' are required here
    // (inline framework + AdSense + JSON-LD; nonce migration is a separate effort);
    // every other directive is locked down (object-src none, frame-ancestors none,
    // base-uri/form-action self).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://checkout.razorpay.com https://*.razorpay.com https://*.googletagmanager.com https://*.google-analytics.com https://plausible.io https://va.vercel-scripts.com https://*.vercel-insights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://*.razorpay.com https://api.razorpay.com https://*.google-analytics.com https://*.googlesyndication.com https://plausible.io https://*.vercel-insights.com",
      "frame-src 'self' https://*.firebaseapp.com https://*.razorpay.com https://*.google.com https://googleads.g.doubleclick.net https://*.googlesyndication.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; ')
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',        value: 'nosniff' },
          { key: 'X-Frame-Options',                value: 'DENY' },
          { key: 'X-XSS-Protection',               value: '1; mode=block' },
          { key: 'Referrer-Policy',                value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',             value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy',        value: csp },
          // HSTS: enforce HTTPS for 1 year, include subdomains, allow preload submission
          { key: 'Strict-Transport-Security',      value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
      // Aggressive cache for static assets
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
