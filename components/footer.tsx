import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-surface-800 mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-surface-100 font-semibold text-sm">AI Execution Lab</p>
            <p className="text-surface-500 text-xs mt-1 max-w-sm">
              Real AI workflows, systems, and case studies from the team building
              asquaresolution.com, TrustSeal, and ScamCheck.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-surface-500">
            <Link href="/docs" className="hover:text-surface-300 transition-colors">Docs</Link>
            <Link href="/systems" className="hover:text-surface-300 transition-colors">Systems</Link>
            <Link href="/labs" className="hover:text-surface-300 transition-colors">Labs</Link>
            <Link href="/case-studies" className="hover:text-surface-300 transition-colors">Case Studies</Link>
            <a
              href="https://asquaresolution.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-400 transition-colors"
            >
              asquaresolution.com ↗
            </a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-surface-800/60 text-xs text-surface-600">
          © {new Date().getFullYear()} A Square Solutions. Built with real execution, not hypothetical examples.
        </div>
      </div>
    </footer>
  )
}
