/**
 * Media types and helpers for the Execution Media System.
 * Used by TerminalRecording, YouTubeWalkthrough, TimelineMarkers, TranscriptBlock.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface MediaChapter {
  /** Chapter title shown in the navigation strip */
  title: string
  /** Start time in seconds */
  start: number
  /** Optional end time in seconds (defaults to next chapter start or end of media) */
  end?: number
  /** Optional anchor id for scroll-to-section behaviour */
  anchor?: string
}

export interface TranscriptEntry {
  /** Timestamp in seconds */
  time: number
  /** Speaker label (e.g. "Claude", "Terminal", "Dev") */
  speaker?: string
  /** The transcript text for this cue */
  text: string
}

export interface MediaManifest {
  /** Unique identifier for this media item */
  id: string
  /** Human-readable title */
  title: string
  /** Total duration in seconds */
  duration: number
  /** ISO 8601 upload/publication date */
  uploadDate: string
  /** Optional short description for VideoObject schema */
  description?: string
  /** Thumbnail URL for VideoObject schema */
  thumbnailUrl?: string
  /** Chapters for navigation */
  chapters?: MediaChapter[]
  /** Transcript entries */
  transcript?: TranscriptEntry[]
}

// ─────────────────────────────────────────────────────────────
// Helper: format seconds → MM:SS or H:MM:SS
// ─────────────────────────────────────────────────────────────

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────
// Helper: format seconds → ISO 8601 duration (PT#M#S)
// Used in VideoObject schema.
// ─────────────────────────────────────────────────────────────

export function formatISO8601Duration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  let out = 'PT'
  if (h > 0) out += `${h}H`
  if (m > 0) out += `${m}M`
  if (s > 0 || (h === 0 && m === 0)) out += `${s}S`
  return out
}
