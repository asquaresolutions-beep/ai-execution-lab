/**
 * Corpus reader.
 *
 * Reads the Lab's existing content and metadata. Owns no content of its own and
 * writes nothing back - if a fact lives in frontmatter or in lib/tracks.ts, it is read
 * from there. `lib/tracks.ts` is parsed as a second metadata source because 24 lessons
 * carry no frontmatter (a caveat carried forward from Lab IA v2).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const LAB_ROOT = join(import.meta.dirname, '..', '..', '..')
export const CONTENT = join(LAB_ROOT, 'content')
export const DATA = join(import.meta.dirname, '..', 'data')

export function loadJson(name) {
  return JSON.parse(readFileSync(join(DATA, name), 'utf8'))
}

/** Minimal YAML frontmatter parse: scalars, inline arrays, block lists. */
export function frontmatter(raw) {
  if (!raw.startsWith('---')) return {}
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return {}
  const fm = {}
  let key = null
  for (const line of raw.slice(3, end).split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const listItem = line.match(/^\s+-\s+(.*)$/)
    if (listItem && key) {
      if (!Array.isArray(fm[key])) fm[key] = []
      fm[key].push(unquote(listItem[1]))
      continue
    }
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!m) continue
    key = m[1]
    const v = m[2].trim()
    if (v === '') fm[key] = []
    else if (v.startsWith('[')) {
      fm[key] = v.slice(1, -1).split(',').map(s => unquote(s.trim())).filter(Boolean)
    } else fm[key] = unquote(v)
  }
  return fm
}

function unquote(s) {
  const t = s.trim()
  if (t.length > 1 && ((t[0] === '"' && t.at(-1) === '"') || (t[0] === "'" && t.at(-1) === "'"))) {
    return t.slice(1, -1)
  }
  return t
}

/** Every .mdx in a content folder, with frontmatter and slug. */
export function readFolder(folder) {
  const dir = join(CONTENT, folder)
  if (!existsSync(dir)) return []
  const out = []
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.mdx')) continue
    const raw = readFileSync(join(dir, f), 'utf8')
    out.push({
      slug: f.replace(/\.mdx$/, ''),
      folder,
      path: `content/${folder}/${f}`,
      fm: frontmatter(raw),
      bytes: raw.length,
    })
  }
  return out
}

/** Nested lesson folders: content/lessons/<track>/<module>/<lesson>.mdx */
export function readLessons() {
  const dir = join(CONTENT, 'lessons')
  if (!existsSync(dir)) return []
  const out = []
  const walk = (d, parts) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p, [...parts, e.name])
      else if (e.name.endsWith('.mdx')) {
        const raw = readFileSync(p, 'utf8')
        out.push({
          slug: e.name.replace(/\.mdx$/, ''),
          folder: 'lessons',
          track: parts[0] ?? null,
          module: parts[1] ?? null,
          path: `content/lessons/${[...parts, e.name].join('/')}`,
          fm: frontmatter(raw),
          bytes: raw.length,
        })
      }
    }
  }
  walk(dir, [])
  return out
}

/**
 * Track/module/lesson ids declared in lib/tracks.ts.
 * Parsed rather than imported: the file is TypeScript and npm is unavailable here.
 * Only ids and titles are extracted - presentation stays in tracks.ts.
 */
export function readTracksTs() {
  const p = join(LAB_ROOT, 'lib', 'tracks.ts')
  if (!existsSync(p)) return { tracks: [], lessonIds: [] }
  const src = readFileSync(p, 'utf8')
  const tracks = []
  const lessonIds = []
  const trackRe = /\{\s*id:\s*'([^']+)',\s*title:\s*'([^']*)'/g
  let m
  while ((m = trackRe.exec(src)) !== null) {
    tracks.push({ id: m[1], title: m[2] })
  }
  const idRe = /\bid:\s*'([a-z0-9-]+)'/g
  while ((m = idRe.exec(src)) !== null) lessonIds.push(m[1])

  // Lesson -> University capability, declared by `proves` on the lesson entry.
  // Lesson entries are one object per line in tracks.ts, so this is parsed per
  // line: the id and the proves array must belong to the same entry.
  //
  // Teaching is not proving. This records that instruction EXISTS for a
  // capability; it says nothing about any student. Student attainment lives in
  // progress.mjs (proven_capabilities) and is never derived from here.
  const lessonCapabilities = []
  for (const line of src.split('\n')) {
    const id = line.match(/\bid:\s*'([a-z0-9-]+)'/)
    const pr = line.match(/\bproves:\s*\[([^\]]*)\]/)
    if (!id || !pr) continue
    const capabilities = pr[1]
      .split(',')
      .map(s => unquote(s.trim()))
      .filter(Boolean)
    if (capabilities.length) lessonCapabilities.push({ lessonId: id[1], capabilities })
  }

  return { tracks, lessonIds: [...new Set(lessonIds)], lessonCapabilities }
}

export function corpus() {
  return {
    failures: readFolder('failures'),
    labs: readFolder('labs'),
    logs: readFolder('logs'),
    caseStudies: readFolder('case-studies'),
    playbooks: readFolder('playbooks'),
    docs: readFolder('docs'),
    systems: readFolder('systems'),
    lessons: readLessons(),
    tracksTs: readTracksTs(),
  }
}

/** Normalise the inconsistent `project` field using the declared alias map. */
export function normaliseSystem(value, aliases) {
  if (!value) return null
  return aliases[value] ?? aliases[String(value).trim()] ?? String(value).trim()
}
