'use client'

export function SearchTrigger() {
  function open() {
    window.dispatchEvent(new Event('search:open'))
  }

  return (
    <button
      onClick={open}
      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] text-left hover:bg-white/[0.06] hover:border-white/[0.12] transition-all group"
    >
      <svg
        className="w-3.5 h-3.5 text-surface-600 group-hover:text-surface-400 transition-colors shrink-0"
        fill="none" viewBox="0 0 15 15"
      >
        <path
          d="M10 6.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zm-.47 3.59l2.88 2.88"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
        />
      </svg>
      <span className="flex-1 text-xs text-surface-600 group-hover:text-surface-500 transition-colors">
        Search...
      </span>
      <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-surface-700 font-mono bg-white/[0.04] border border-white/[0.06] rounded px-1 py-0.5">
        ⌘K
      </kbd>
    </button>
  )
}
