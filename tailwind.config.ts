import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.mdx',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // A Square Solutions brand
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',  // primary brand orange
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // Lab surface colours (dark-first)
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'DM Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      typography: (theme: (path: string) => string) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.surface.600'),
            '--tw-prose-headings': theme('colors.surface.900'),
            '--tw-prose-links': theme('colors.brand.500'),
            '--tw-prose-code': theme('colors.surface.800'),
            '--tw-prose-pre-bg': theme('colors.surface.900'),
            maxWidth: '72ch',
          },
        },
        invert: {
          css: {
            '--tw-prose-body': theme('colors.surface.300'),
            '--tw-prose-headings': theme('colors.surface.50'),
            '--tw-prose-links': theme('colors.brand.400'),
            '--tw-prose-code': theme('colors.surface.200'),
            '--tw-prose-pre-bg': theme('colors.surface.800'),
          },
        },
      }),
    },
  },
  plugins: [typography],
}

export default config
