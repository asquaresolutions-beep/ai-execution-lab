/**
 * Assessment, certification and project engines.
 *
 * The post-mortem is the assessment. Nothing here scores effort, length or
 * presentation - only the three rubric criteria, which are the same ones this company
 * applies to its own research.
 */
import { loadJson } from './corpus.mjs'

export const loadRubric = () => loadJson('rubric.json')
export const loadCertification = () => loadJson('certification.json')

/**
 * Score a post-mortem submission.
 * `scores` is { evidence_quality, honesty, reproducibility } on the 0-3 scale.
 */
export function assess(submission, rubric = loadRubric()) {
  const rows = rubric.criteria.map(c => {
    const raw = submission.scores?.[c.id]
    const scored = Number.isInteger(raw) && raw >= 0 && raw <= 3
    return {
      criterion: c.id,
      name: c.name,
      score: scored ? raw : null,
      pass: scored ? raw >= rubric.pass_mark : false,
      unscored: !scored,
      fails_when: c.fails_when,
    }
  })
  const unscored = rows.filter(r => r.unscored)
  const failed = rows.filter(r => !r.pass && !r.unscored)
  const verdict = unscored.length ? 'incomplete' : (failed.length ? 'returned' : 'passed')
  return {
    verdict,
    rows,
    returns: [...failed, ...unscored].map(r => ({
      criterion: r.criterion,
      missing: r.unscored ? 'not scored' : r.fails_when,
      to_satisfy: `raise ${r.name} to at least ${rubric.pass_mark} on the 0-3 scale`,
    })),
  }
}

/** Evaluate one competency's portfolio against the required submissions. */
export function evaluateCertification(portfolio, cert = loadCertification()) {
  const req = cert.certification.required_submissions
  const rows = req.map(r => {
    const item = portfolio.submissions?.[r.id]
    let ok = Boolean(item)
    let detail = ok ? '' : 'not submitted'
    if (ok && r.check === 'reachable_url') {
      ok = /^https?:\/\//.test(String(item))
      detail = ok ? String(item) : 'not a reachable URL - a localhost demo is not an artefact'
    }
    if (ok && r.check === 'rubric') {
      const a = assess({ scores: portfolio.rubric_scores ?? {} })
      ok = a.verdict === 'passed'
      detail = ok ? 'post-mortem passed' : `post-mortem ${a.verdict}`
    }
    return { id: r.id, statement: r.statement, pass: ok, detail }
  })
  const failed = rows.filter(r => !r.pass)
  return {
    competency: portfolio.competency,
    rows,
    certifiable: failed.length === 0,
    outstanding: failed.map(r => r.id),
  }
}

/** Graduation - four of six including Operating, plus three standing requirements. */
export function evaluateGraduation(student, cert = loadCertification()) {
  const g = cert.graduation.requirements
  const certified = new Set(student.certified ?? [])
  const rows = g.map(r => {
    let pass = false
    let detail = ''
    if (r.type === 'competency_count') {
      const haveMandatory = (r.mandatory ?? []).every(m => certified.has(m))
      pass = certified.size >= r.count && haveMandatory
      const missing = (r.mandatory ?? []).filter(m => !certified.has(m))
      detail = `${certified.size}/${r.count} certified` +
        (missing.length ? `; missing mandatory: ${missing.join(', ')}` : '')
    } else if (r.type === 'uptime_days') {
      const d = student.live_system_days ?? 0
      pass = d >= r.days
      detail = `${d}/${r.days} days`
    } else if (r.type === 'accepted_contribution') {
      pass = Boolean(student.accepted_contribution)
      detail = pass ? String(student.accepted_contribution) : 'none accepted'
    } else if (r.type === 'external_postmortem') {
      pass = Boolean(student.external_postmortem)
      detail = pass ? String(student.external_postmortem) : 'none submitted'
    }
    return { id: r.id, statement: r.statement, pass, detail }
  })
  return {
    rows,
    graduated: rows.every(r => r.pass),
    outstanding: rows.filter(r => !r.pass).map(r => r.id),
  }
}

/**
 * Project engine. A project is the Proof beat: a deployed thing that can break.
 * Templates are derived from the competency, not authored as content.
 */
export function projectBrief(competency, units) {
  const relevant = units.filter(u => u.competency === competency && u.teachable)
  return {
    competency,
    requirement: 'One publicly reachable system you operate.',
    must_survive: relevant.slice(0, 5).map(u => ({ unit: u.id, title: u.title })),
    acceptance: [
      'reachable at a URL a stranger can open',
      'you can show the log for one deliberate failure',
      'you can show the fix',
      'you can show the post-mortem',
    ],
    note: relevant.length === 0
      ? 'No teachable unit maps to this competency yet - a project here cannot be assessed against a real failure.'
      : `${relevant.length} teachable unit(s) supply failures this project must survive.`,
  }
}

/**
 * Lab engine. The reproduction task: cause the failure deliberately, then fix it.
 * Derived from the incident's own metadata - never invented.
 */
export function reproductionTask(unit) {
  if (!unit.beats.practice.present) {
    return {
      unit: unit.id,
      available: false,
      reason: 'no reproduction lab matches this incident',
      needed: `a lab in content/labs/ declaring \`reproduces: [${unit.id}]\` in its frontmatter`,
    }
  }
  return {
    unit: unit.id,
    available: true,
    incident: unit.beats.incident.source,
    lab: unit.beats.practice.source,
    systems: unit.systems,
    severity: unit.severity,
    steps: [
      'read the incident, not the fix',
      'reproduce the failure deliberately in a system you control',
      'capture the log that proves you reproduced it',
      'apply your own fix before reading ours',
      'compare, then write the post-mortem',
    ],
  }
}
