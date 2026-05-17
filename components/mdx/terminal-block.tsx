/**
 * TerminalBlock — macOS-style terminal window with traffic-light chrome.
 *
 * Usage with session array (recommended):
 *   <TerminalBlock session={[
 *     { cmd: "claude --version", out: "1.0.17 (Claude Code)" },
 *     { cmd: "/status", out: "API Status: Connected\nModel: claude-opus-4-5" },
 *   ]} />
 *
 * Usage with raw children (for free-form content):
 *   <TerminalBlock title="bash">
 *     <code>...</code>
 *   </TerminalBlock>
 */

interface SessionLine {
  /** The command (shown with $ prompt) */
  cmd: string
  /** The output (shown below in muted text). May contain \n for multi-line. */
  out?: string
  /** Prompt symbol override — defaults to '$' */
  prompt?: string
}

interface TerminalBlockProps {
  title?: string
  session?: SessionLine[]
  children?: React.ReactNode
}

export function TerminalBlock({ title = 'terminal', session, children }: TerminalBlockProps) {
  return (
    <div className="my-6 rounded-xl overflow-hidden border border-surface-700/50 shadow-2xl shadow-black/40">
      {/* Chrome bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1c1c1e] border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[11px] font-mono text-surface-600 ml-2 select-none">{title}</span>
      </div>

      {/* Body */}
      <div className="bg-[#0d1117] px-5 py-4 font-mono text-sm leading-relaxed overflow-x-auto">
        {session ? (
          <div className="space-y-1">
            {session.map((line, i) => (
              <div key={i}>
                {/* Command line */}
                <div className="flex items-start gap-2">
                  <span className="text-[#57c14a] select-none shrink-0">
                    {line.prompt ?? '$'}
                  </span>
                  <span className="text-[#e6edf3]">{line.cmd}</span>
                </div>
                {/* Output lines */}
                {line.out && line.out.split('\n').map((outLine, j) => (
                  <div key={j} className="text-[#8b949e] pl-4 leading-snug">
                    {outLine}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[#e6edf3] [&_code]:bg-transparent [&_code]:text-current [&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:m-0">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
