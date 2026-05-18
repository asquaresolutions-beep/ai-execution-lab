/**
 * lib/bookmarks.ts
 * Client-side bookmark persistence via localStorage.
 * No auth dependency — operator reading queue without sign-in.
 */

const STORAGE_KEY = 'ael:bookmarks'
const MAX_BOOKMARKS = 50

export interface Bookmark {
  href:        string
  title:       string
  type:        string   // 'lesson' | 'failure' | 'playbook' | etc.
  addedAt:     string   // ISO date
  section?:    string   // track title, section label, etc.
}

// ─────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────

function readStorage(): Bookmark[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Bookmark[]
  } catch {
    return []
  }
}

function writeStorage(items: Bookmark[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_BOOKMARKS)))
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function getBookmarks(): Bookmark[] {
  return readStorage()
}

export function isBookmarked(href: string): boolean {
  return readStorage().some(b => b.href === href)
}

export function addBookmark(item: Omit<Bookmark, 'addedAt'>): void {
  const current = readStorage()
  if (current.some(b => b.href === item.href)) return  // already exists
  writeStorage([{ ...item, addedAt: new Date().toISOString() }, ...current])
}

export function removeBookmark(href: string): void {
  const current = readStorage()
  writeStorage(current.filter(b => b.href !== href))
}

export function toggleBookmark(item: Omit<Bookmark, 'addedAt'>): boolean {
  if (isBookmarked(item.href)) {
    removeBookmark(item.href)
    return false
  } else {
    addBookmark(item)
    return true
  }
}

export function clearBookmarks(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
