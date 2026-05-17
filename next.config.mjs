/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow MDX files to be imported as pages in future if needed
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],

  // Strict mode — catch problems early
  reactStrictMode: true,

  // Image domains for external images (add as needed)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'asquaresolution.com',
      },
    ],
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ]
  },
}

export default nextConfig
