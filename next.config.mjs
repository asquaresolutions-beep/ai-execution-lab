/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow MDX files to be imported as pages in future if needed
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],

  // Strict mode — catch problems early
  reactStrictMode: true,

  // Don't expose Next.js version header in production
  poweredByHeader: false,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'asquaresolution.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com', // YouTube thumbnails
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Strip console.log in production (keep warn/error)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // Security & caching headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // Aggressive cache for static assets
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Cache fonts
      {
        source: '/fonts/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
