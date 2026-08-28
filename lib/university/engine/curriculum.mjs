/**
 * Curriculum engine.
 *
 * Builds units from the corpus that already exists. It authors nothing: where a beat
 * has no source document, the unit is reported incomplete rather than filled in.
 *
 * A unit runs four beats - Incident, Principle, Practice, Proof. The Incident beat is
 * a real production failure; that is why the curriculum is harvested rather than
 * written.
 */
import { corpus, loadJson, normaliseSystem } from './corpus.mjs'

const BEATS = ['incident', 'principle', 'practice', 'proof']

/** Score a document against the classification rules. Ambiguity is reported, not resolved. */
export function classify(doc, rules) {
  const fm = doc.fm ?? {}
  const tags = (fm.tags ?? []).map(t => String(t).toLowerCase())
  const title = String(fm.title ?? doc.slug).toLowerCase()
  const systems = [
    ...(fm.systems_touched ?? []),
    ...(fm.affected_systems ?? []),
    normaliseSystem(fm.project, rules.system_aliases),
  ].filter(Boolean).map(s => String(s).toLowerCase())

  const scores = {}
  const why = {}
  for (const [comp, sig] of Object.entries(rules.signals)) {
    let s = 0
    const hits = []
    for (const t of sig.tag ?? []) {
      if (tags.includes(t)) { s += rules.weights.tag; hits.push(`tag:${t}`) }
    }
    if ((sig.failure_type ?? []).includes(String(fm.failure_type ?? '').toLowerCase())) {
      s += rules.weights.failure_type
      hits.push(`failure_type:${fm.failure_type}`)
    }
    for (const sy of sig.system ?? []) {
      if (systems.includes(sy)) { s += rules.weights.system; hits.push(`system:${sy}`) }
    }
    for (const k of sig.title_keyword ?? []) {
      if (title.includes(k)) { s += rules.weights.title_keyword; hits.push(`title:${k}`) }
    }
    if (s > 0) { scores[comp] = s; why[comp] = hits }
  }

  // Structural rules - independent of tags. See rules.structural.
  const structural = []
  const op = rules.structural?.operating
  if (op) {
    const resolved = String(fm.failure_status ?? '').toLowerCase() === op.requires.failure_status
    const hasSeverity = Boolean(fm.severity)
    if (resolved && hasSeverity) {
      structural.push('operating')
      const sev = String(fm.severity).toLowerCase()
      const weight = sev === op.grants_primary_when_severity ? 99 : rules.secondary_floor
      scores.operating = Math.max(scores.operating ?? 0, weight)
      why.operating = [...(why.operating ?? []), `structural:${sev}-severity resolved incident`]
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (ranked.length === 0) {
    return { competency: null, competencies: [], status: 'unmapped', scores, why }
  }
  const [top, topScore] = ranked[0]
  const runnerUp = ranked[1]?.[1] ?? 0
  const secondary = ranked
    .filter(([c, s]) => c !== top && s >= rules.secondary_floor)
    .map(([c]) => c)

  if (topScore - runnerUp < rules.win_margin && ranked.length > 1) {
    return {
      competency: null,
      competencies: ranked.filter(([, s]) => s >= rules.secondary_floor).map(([c]) => c),
      status: 'ambiguous',
      candidates: ranked.slice(0, 3).map(([c, s]) => ({ competency: c, score: s })),
      scores, why,
    }
  }
  return {
    competency: top,
    competencies: [top, ...secondary],
    secondary,
    structural,
    status: 'classified',
    score: topScore,
    scores,
    why: why[top],
  }
}

/** Match a lab to an incident by shared tags - the Practice beat. */
function findPractice(incident, labs) {
  const iTags = new Set((incident.fm.tags ?? []).map(t => String(t).toLowerCase()))
  let best = null
  let bestOverlap = 0
  for (const lab of labs) {
    const lTags = (lab.fm.tags ?? []).map(t => String(t).toLowerCase())
    const overlap = lTags.filter(t => iTags.has(t)).length
    if (overlap > bestOverlap) { best = lab; bestOverlap = overlap }
  }
  return bestOverlap >= 2 ? { doc: best, overlap: bestOverlap } : null
}

/** Match a doc to an incident for the Principle beat. */
function findPrinciple(incident, docs) {
  const refs = incident.fm.related_docs ?? []
  if (refs.length) {
    const hit = docs.find(d => refs.includes(d.slug))
    if (hit) return { doc: hit, via: 'related_docs' }
  }
  return null
}

export function buildUnits() {
  const c = corpus()
  const rules = loadJson('rules.json')
  const units = []

  for (const inc of c.failures) {
    const cls = classify(inc, rules)
    const practice = findPractice(inc, c.labs)
    const principle = findPrinciple(inc, c.docs)
    const systems = [
      ...(inc.fm.systems_touched ?? []),
      normaliseSystem(inc.fm.project, rules.system_aliases),
    ].filter(Boolean)

    const beats = {
      incident: { source: inc.path, present: true },
      principle: principle
        ? { source: principle.doc.path, present: true, via: principle.via }
        : { source: null, present: false, gap: 'no principle document linked' },
      practice: practice
        ? { source: practice.doc.path, present: true, tag_overlap: practice.overlap }
        : { source: null, present: false, gap: 'no reproduction lab matches this incident' },
      proof: { source: null, present: false, produced_by: 'project engine' },
    }

    units.push({
      id: inc.slug,
      title: inc.fm.title ?? inc.slug,
      competency: cls.competency,
      competencies: cls.competencies ?? [],
      secondary: cls.secondary ?? [],
      classification: cls.status,
      classification_evidence: cls.why ?? null,
      candidates: cls.candidates ?? null,
      severity: inc.fm.severity ?? null,
      failure_type: inc.fm.failure_type ?? null,
      systems: [...new Set(systems.map(s => String(s).toLowerCase()))],
      linked_incidents: inc.fm.linked_incidents ?? [],
      beats,
      complete: BEATS.filter(b => beats[b].present).length,
      teachable: beats.incident.present && beats.practice.present,
      state: 'active',
    })
  }
  return units
}

export function curriculumSummary(units) {
  const byComp = {}      // primary only
  const teaches = {}     // primary or secondary - what a competency can draw on
  for (const u of units) {
    const k = u.competency ?? `_${u.classification}`
    byComp[k] = (byComp[k] ?? 0) + 1
    for (const c of u.competencies ?? []) teaches[c] = (teaches[c] ?? 0) + 1
  }
  return {
    units: units.length,
    by_competency: byComp,
    teaches,
    teachable: units.filter(u => u.teachable).length,
    missing_principle: units.filter(u => !u.beats.principle.present).length,
    missing_practice: units.filter(u => !u.beats.practice.present).length,
    unmapped: units.filter(u => u.classification === 'unmapped').map(u => u.id),
    ambiguous: units.filter(u => u.classification === 'ambiguous').map(u => u.id),
  }
}
