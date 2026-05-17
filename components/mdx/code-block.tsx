'use client'

import { useState } from 'react'

// Named code block with filename header and copy button.
// Usage in MDX:
//   <CodeBlock filename="patch_post.py" language="python">
//   {`import urllib.request
//   ...`}
//   </CodeBlock>

export function CodeBlock({
  filename,
  language,
  children,
}: {
  filename?: string
  language?: string
  children: string
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const text = typeof children === 'string' ? children : String(children)
    navigator.clipboard.writeText(text.trim()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const ext = filename?.split('.').pop() ?? language ?? ''

  return (
    <div className="my-6 rounded-xl border border-surface-700/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-900/80 border-b border-surface-800/60">
        <div className="flex items-center gap-2.5">
          {/* Traffic light dots */}
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-surface-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-surface-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-surface-700" />
          </div>
          {filename && (
            <span className="text-xs font-mono text-surface-400">{filename}</span>
          )}
          {!filename && language && (
            <span className="text-xs font-mono text-surface-600">{language}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="text-[11px] text-surface-500 hover:text-surface-300 transition-colors font-mono"
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>

      {/* Code */}
      <pre className="overflow-x-auto bg-surface-950/80 p-4 text-sm leading-relaxed">
        <code className={language ? `language-${language}` : undefined}>
          {typeof children === 'string' ? children.trim() : children}
        </code>
      </pre>
    </div>
  )
}
