/**
 * Competency graph and prerequisite engine.
 *
 * The graph is a DAG over six competencies. Prerequisites are expressed as
 * capabilities a student can prove, never as lessons they must sit through - so the
 * engine answers "what can this student attempt now", not "what comes next in the list".
 */
import { loadJson } from './corpus.mjs'

export function loadGraph() {
  const { competencies } = loadJson('competencies.json')
  const byId = new Map(competencies.map(c => [c.id, c]))
  return { competencies, byId }
}

export function loadCapabilities() {
  return loadJson('capabilities.json').capabilities
}

/** Cycle detection - a competency graph with a cycle is unnavigable. */
export function validateGraph(graph) {
  const errors = []
  const { competencies, byId } = graph
  for (const c of competencies) {
    for (const r of c.requires) {
      if (!byId.has(r)) errors.push(`${c.id} requires unknown competency '${r}'`)
    }
  }
  const state = new Map()
  const visit = (id, path) => {
    if (state.get(id) === 'done') return
    if (state.get(id) === 'open') {
      errors.push(`cycle: ${[...path, id].join(' -> ')}`)
      return
    }
    state.set(id, 'open')
    for (const r of byId.get(id)?.requires ?? []) visit(r, [...path, id])
    state.set(id, 'done')
  }
  for (const c of competencies) visit(c.id, [])
  return errors
}

/** Topological depth - used for display order only, never to force a sequence. */
export function depth(graph, id, seen = new Set()) {
  if (seen.has(id)) return 0
  seen.add(id)
  const reqs = graph.byId.get(id)?.requires ?? []
  return reqs.length === 0 ? 0 : 1 + Math.max(...reqs.map(r => depth(graph, r, seen)))
}

/** Transitive prerequisites of a competency. */
export function ancestors(graph, id, out = new Set()) {
  for (const r of graph.byId.get(id)?.requires ?? []) {
    if (!out.has(r)) {
      out.add(r)
      ancestors(graph, r, out)
    }
  }
  return out
}

/**
 * What a student may attempt now.
 *
 * A competency is unlocked when every prerequisite competency is certified OR every
 * capability under it has been proven. Proving capabilities is the bypass that makes
 * the tree navigable rather than a queue.
 */
export function unlocked(graph, capabilities, student) {
  const certified = new Set(student.certified ?? [])
  const proven = new Set(student.proven_capabilities ?? [])
  const capsOf = id => capabilities.filter(c => c.competency === id)

  const satisfied = id => {
    if (certified.has(id)) return true
    const caps = capsOf(id)
    return caps.length > 0 && caps.every(c => proven.has(c.id))
  }

  return graph.competencies.map(c => {
    const missing = c.requires.filter(r => !satisfied(r))
    return {
      id: c.id,
      name: c.name,
      certified: certified.has(c.id),
      unlocked: missing.length === 0,
      blocked_by: missing,
      capabilities: capsOf(c.id).map(cap => ({
        id: cap.id,
        proven: proven.has(cap.id),
        statement: cap.statement,
        proof_task: cap.proof_task,
      })),
    }
  })
}

/**
 * Instructional coverage: which capabilities have explicitly mapped teaching content.
 *
 * `taught` means one thing only - at least one lesson declares this capability in its
 * `proves` array (lib/tracks.ts). It does NOT mean practiced, demonstrated, proven,
 * certified, or graduation-eligible. A capability is PROVEN by a student artefact
 * accepted through proveCapability() (progress.mjs); this function never touches
 * student state and is never consulted by unlocked().
 *
 * Content-level only. Sits below `exposure` on the progress ladder
 * (exposure -> reproduction -> capability -> certification) and advances nothing.
 *
 * Assets come from explicit `proves` declarations, never from tag overlap.
 * A `proves` value naming no known capability is reported in `unknown`, never guessed
 * and never silently dropped.
 */
export function capabilityCoverage(capabilities, lessonCapabilities = []) {
  const known = new Set(capabilities.map(c => c.id))
  const byCap = new Map()
  const unknown = []

  for (const { lessonId, capabilities: caps } of lessonCapabilities) {
    for (const capId of caps) {
      if (!known.has(capId)) { unknown.push({ lessonId, capability: capId }); continue }
      if (!byCap.has(capId)) byCap.set(capId, [])
      if (!byCap.get(capId).includes(lessonId)) byCap.get(capId).push(lessonId)
    }
  }

  const rows = capabilities.map(c => ({
    id:              c.id,
    competency:      c.competency,
    statement:       c.statement,
    taught:          byCap.has(c.id),
    teaching_assets: byCap.get(c.id) ?? [],
  }))

  return {
    capabilities:   rows,
    taught:         rows.filter(r => r.taught),
    untaught:       rows.filter(r => !r.taught),
    taught_count:   rows.filter(r => r.taught).length,
    untaught_count: rows.filter(r => !r.taught).length,
    total:          rows.length,
    assets_mapped:  lessonCapabilities.length,
    unknown,
  }
}

/** The next proof tasks a student could take, nearest first. */
export function nextProofTasks(graph, capabilities, student, limit = 5) {
  const rows = unlocked(graph, capabilities, student)
  const out = []
  for (const r of rows) {
    if (!r.unlocked || r.certified) continue
    for (const cap of r.capabilities) {
      if (!cap.proven) out.push({ competency: r.id, ...cap })
    }
  }
  return out.slice(0, limit)
}
