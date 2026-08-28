#!/usr/bin/env node
/**
 * AI Lab University Engine.
 *
 *   node lib/university/university.mjs <command>
 *
 * The institutional engine: competency graph, curriculum mapping, prerequisites,
 * certification, assessment, projects, labs, research integration, progress and
 * governance. It creates no lessons, no content and no videos - it maps the corpus that
 * already exists and reports what is missing.
 *
 *   status                  one screen
 *   graph                   competency graph + validation
 *   curriculum              units built from the corpus
 *   gaps                    what the curriculum is missing
 *   unit <id>               one unit in full
 *   lab <id>                the reproduction task
 *   research                Evidencing units from the Research Hub
 *   student <id>            a student's standing
 *   prove <id> <cap> <url>  accept a proof task
 *   assess <a> <h> <r>      score a post-mortem (0-3 each)
 *   project <competency>    project brief
 *   governance              integrity check
 *   report                  write build/university/
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadGraph, loadCapabilities, validateGraph, depth, unlocked, nextProofTasks } from './engine/graph.mjs'
import { buildUnits, curriculumSummary } from './engine/curriculum.mjs'
import { assess, evaluateCertification, evaluateGraduation, projectBrief, reproductionTask, loadRubric } from './engine/assessment.mjs'
import { evidencingUnits, contributionRoute, researchAvailable } from './engine/research.mjs'
import { loadStudent, saveStudent, allStudents, proveCapability, SIGNALS } from './engine/progress.mjs'
import { loadGovernance, integrityCheck, classifyChange, bump } from './engine/governance.mjs'
import { LAB_ROOT } from './engine/corpus.mjs'

const p = (s = '') => console.log(s)
const rule = (n = 74) => p('-'.repeat(n))
const mark = ok => (ok ? 'OK  ' : 'FAIL')

const cmds = {}

cmds.status = () => {
  const graph = loadGraph()
  const caps = loadCapabilities()
  const units = buildUnits()
  const sum = curriculumSummary(units)
  const gov = loadGovernance()
  const res = evidencingUnits()
  const students = allStudents()

  p('AI LAB UNIVERSITY ENGINE')
  rule()
  p(`curriculum version : ${gov.curriculum_version}  (${gov.approval_log[0]?.approved_by === 'pending' ? 'APPROVAL PENDING' : 'approved'})`)
  p(`competencies       : ${graph.competencies.length}   capabilities: ${caps.length}`)
  p(`units from corpus  : ${sum.units}   teachable: ${sum.teachable}`)
  p(`evidencing units   : ${res.available ? res.units.length : 'research repo not reachable'}`)
  p(`students           : ${students.length}`)
  rule()
  p('UNITS BY COMPETENCY        primary   teaches   (a unit may teach several)')
  for (const c of graph.competencies) {
    const n = sum.by_competency[c.id] ?? 0
    const t = sum.teaches[c.id] ?? 0
    p(`  ${c.name.padEnd(22)}${String(n).padStart(5)}${String(t).padStart(10)}   ${c.scope}`)
  }
  const un = sum.by_competency._unmapped ?? 0
  const am = sum.by_competency._ambiguous ?? 0
  if (un || am) {
    p(`  ${'(unclassified)'.padEnd(22)}${String(un + am).padStart(5)}${''.padStart(10)}   reported, never guessed`)
  }
  rule()
  p(`missing principle beat : ${sum.missing_principle}`)
  p(`missing practice beat  : ${sum.missing_practice}`)
  return 0
}

cmds.graph = () => {
  const graph = loadGraph()
  const caps = loadCapabilities()
  const errors = validateGraph(graph)
  p('COMPETENCY GRAPH')
  rule()
  for (const c of [...graph.competencies].sort((a, b) => depth(graph, a.id) - depth(graph, b.id))) {
    const d = depth(graph, c.id)
    const n = caps.filter(x => x.competency === c.id).length
    p(`${'  '.repeat(d)}${c.name}  (${c.id})`)
    p(`${'  '.repeat(d)}  requires: ${c.requires.join(', ') || 'nothing'}   capabilities: ${n}`)
  }
  rule()
  p(errors.length ? `INVALID:\n  ${errors.join('\n  ')}` : 'graph valid - acyclic, all references resolve')
  return errors.length ? 1 : 0
}

cmds.curriculum = () => {
  const units = buildUnits()
  p('CURRICULUM')
  rule(96)
  p(`${'unit'.padEnd(42)}${'competency'.padEnd(14)}${'beats'.padEnd(7)}${'sev'.padEnd(8)}systems`)
  rule(96)
  for (const u of units) {
    p(`${u.id.slice(0, 40).padEnd(42)}${(u.competency ?? u.classification).padEnd(14)}` +
      `${(u.complete + '/4').padEnd(7)}${(u.severity ?? '-').padEnd(8)}${u.systems.join(',')}`)
  }
  rule(96)
  const s = curriculumSummary(units)
  p(`${s.units} units · ${s.teachable} teachable (incident + reproduction both present)`)
  return 0
}

cmds.gaps = () => {
  const units = buildUnits()
  const s = curriculumSummary(units)
  p('CURRICULUM GAPS')
  rule()
  p('These are reported, not filled. The engine authors nothing.')
  p('')
  p(`Missing PRINCIPLE beat (${s.missing_principle}) - the generalisable rule is unwritten:`)
  for (const u of units.filter(u => !u.beats.principle.present)) p(`    ${u.id}`)
  p('')
  p(`Missing PRACTICE beat (${s.missing_practice}) - no reproduction lab matches:`)
  for (const u of units.filter(u => !u.beats.practice.present)) p(`    ${u.id}`)
  p('')
  if (s.unmapped.length) {
    p(`UNMAPPED (${s.unmapped.length}) - no rule claims these:`)
    for (const id of s.unmapped) p(`    ${id}`)
    p('')
  }
  if (s.ambiguous.length) {
    p(`AMBIGUOUS (${s.ambiguous.length}) - two competencies scored too close to call:`)
    for (const id of s.ambiguous) {
      const u = units.find(x => x.id === id)
      p(`    ${id}  -> ${u.candidates.map(c => `${c.competency}(${c.score})`).join(' vs ')}`)
    }
  }
  return 0
}

cmds.unit = ([id]) => {
  const u = buildUnits().find(x => x.id === id)
  if (!u) { p(`unit '${id}' not found`); return 1 }
  p(u.title)
  rule()
  p(`id          : ${u.id}`)
  p(`competency  : ${u.competency ?? u.classification}`)
  p(`evidence    : ${Array.isArray(u.classification_evidence) ? u.classification_evidence.join(', ') : '-'}`)
  p(`severity    : ${u.severity}   type: ${u.failure_type}`)
  p(`systems     : ${u.systems.join(', ') || '-'}`)
  p(`linked      : ${u.linked_incidents.join(', ') || '-'}`)
  p('')
  p('BEATS')
  for (const b of ['incident', 'principle', 'practice', 'proof']) {
    const v = u.beats[b]
    p(`  [${mark(v.present)}] ${b.padEnd(10)}${v.source ?? v.gap ?? v.produced_by ?? ''}`)
  }
  return 0
}

cmds.lab = ([id]) => {
  const u = buildUnits().find(x => x.id === id)
  if (!u) { p(`unit '${id}' not found`); return 1 }
  const t = reproductionTask(u)
  p(`REPRODUCTION TASK - ${u.id}`)
  rule()
  if (!t.available) { p(`unavailable: ${t.reason}`); p(`needed: ${t.needed}`); return 1 }
  p(`incident : ${t.incident}`)
  p(`lab      : ${t.lab}`)
  p(`systems  : ${t.systems.join(', ')}`)
  p('')
  t.steps.forEach((s, i) => p(`  ${i + 1}. ${s}`))
  return 0
}

cmds.research = () => {
  const r = evidencingUnits()
  p('RESEARCH INTEGRATION - Evidencing units')
  rule(92)
  if (!r.available) { p(r.reason); return 1 }
  p(`${'study'.padEnd(34)}${'stage'.padEnd(14)}${'conf'.padEnd(8)}${'lims'.padEnd(6)}teachable`)
  rule(92)
  for (const u of r.units) {
    p(`${u.study.padEnd(34)}${u.stage.padEnd(14)}${(u.confidence ?? '-').padEnd(8)}` +
      `${String(u.limitations).padEnd(6)}${u.teachable ? 'yes' : 'NO'}`)
    if (!u.teachable) p(`    ${u.not_teachable_because}`)
  }
  rule(92)
  p('Student contributions are governed by RESEARCH_STANDARD.md and recorded in the ROS.')
  p('This engine never writes to the research repository.')
  return 0
}

cmds.student = ([id]) => {
  if (!id) {
    const all = allStudents()
    p(`students: ${all.length}`)
    for (const s of all) p(`  ${s.id.padEnd(20)}${s.certified.length}/6 certified, ${s.proven_capabilities.length} capabilities`)
    return 0
  }
  const s = loadStudent(id)
  const graph = loadGraph()
  const caps = loadCapabilities()
  p(`STUDENT ${s.id}`)
  rule()
  p(`curriculum version : ${s.curriculum_version ?? '-'}`)
  p(`certified          : ${s.certified.join(', ') || 'none'}`)
  p(`capabilities       : ${s.proven_capabilities.length}/${caps.length}`)
  p('')
  p('COMPETENCY STANDING')
  for (const r of unlocked(graph, caps, s)) {
    const state = r.certified ? 'certified' : r.unlocked ? 'open' : `locked (${r.blocked_by.join(', ')})`
    const proven = r.capabilities.filter(c => c.proven).length
    p(`  ${r.name.padEnd(14)}${state.padEnd(46)}${proven}/${r.capabilities.length} capabilities`)
  }
  p('')
  const next = nextProofTasks(graph, caps, s)
  p('NEXT PROOF TASKS')
  if (!next.length) p('  none available - certify an open competency first')
  for (const t of next) p(`  [${t.competency}] ${t.id}\n      ${t.proof_task}`)
  p('')
  const g = evaluateGraduation(s)
  p('GRADUATION')
  for (const r of g.rows) p(`  [${mark(r.pass)}] ${r.statement}  (${r.detail})`)
  p(`  ${g.graduated ? 'ELIGIBLE' : `not eligible - ${g.outstanding.length} outstanding`}`)
  return 0
}

cmds.prove = ([id, cap, artifact]) => {
  const gov = loadGovernance()
  const s = loadStudent(id)
  proveCapability(s, cap, artifact, gov.curriculum_version)
  saveStudent(s)
  p(`${id}: capability '${cap}' proven`)
  p(`artefact: ${artifact}`)
  return 0
}

cmds.assess = ([a, h, r]) => {
  const res = assess({ scores: { evidence_quality: +a, honesty: +h, reproducibility: +r } })
  const rub = loadRubric()
  p('POST-MORTEM ASSESSMENT')
  rule()
  for (const row of res.rows) {
    p(`  [${mark(row.pass)}] ${row.name.padEnd(32)}${row.score ?? '-'}/3`)
  }
  rule()
  p(`verdict: ${res.verdict.toUpperCase()}   (pass mark ${rub.pass_mark}/3 on every criterion)`)
  for (const r2 of res.returns) p(`  ${r2.criterion}: ${r2.missing}\n      ${r2.to_satisfy}`)
  return res.verdict === 'passed' ? 0 : 1
}

cmds.project = ([competency]) => {
  const b = projectBrief(competency, buildUnits())
  p(`PROJECT BRIEF - ${competency}`)
  rule()
  p(b.requirement)
  p('')
  p('Must survive:')
  for (const m of b.must_survive) p(`  ${m.unit}`)
  p('')
  p('Acceptance:')
  for (const a of b.acceptance) p(`  - ${a}`)
  p('')
  p(b.note)
  return 0
}

cmds.governance = () => {
  const gov = loadGovernance()
  const chk = integrityCheck(buildUnits(), allStudents())
  p('ACADEMIC GOVERNANCE')
  rule()
  p(`curriculum version : ${gov.curriculum_version}   effective ${gov.effective_from}`)
  p(`latest approval    : ${gov.approval_log[0].approved_by}`)
  p('')
  p('INTEGRITY')
  for (const r of chk.rows) p(`  [${mark(r.pass)}] ${r.rule}${r.detail ? `\n         ${r.detail}` : ''}`)
  rule()
  p(chk.ok ? 'governance clean' : 'governance FAILING - certificates may not be issued')
  return chk.ok ? 0 : 1
}

cmds.report = () => {
  const out = join(LAB_ROOT, 'build', 'university')
  mkdirSync(out, { recursive: true })
  const units = buildUnits()
  const sum = curriculumSummary(units)
  const graph = loadGraph()
  const res = evidencingUnits()
  const chk = integrityCheck(units, allStudents())
  const payload = {
    generated: new Date().toISOString(),
    curriculum_version: loadGovernance().curriculum_version,
    competencies: graph.competencies.map(c => c.id),
    summary: sum,
    units,
    evidencing: res.available ? res.units : [],
    governance: chk,
    progress_signals: SIGNALS,
  }
  writeFileSync(join(out, 'university.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8')
  const md = [
    '# AI Lab University — engine state', '',
    `Generated ${payload.generated}. Curriculum v${payload.curriculum_version}.`, '',
    `- Units mapped from corpus: **${sum.units}** (${sum.teachable} teachable)`,
    `- Missing principle beat: ${sum.missing_principle}`,
    `- Missing practice beat: ${sum.missing_practice}`,
    `- Unmapped: ${sum.unmapped.length}  ·  Ambiguous: ${sum.ambiguous.length}`,
    `- Evidencing units: ${res.available ? res.units.length : 'research repo unreachable'}`,
    `- Governance: ${chk.ok ? 'clean' : 'FAILING'}`, '',
    '## Gaps', '',
    'Reported, never filled — the engine authors no content.', '',
    ...units.filter(u => !u.teachable).map(u => `- \`${u.id}\` — ${!u.beats.practice.present ? 'no reproduction lab' : 'incomplete'}`),
  ].join('\n')
  writeFileSync(join(out, 'STATUS.md'), md + '\n', 'utf8')
  p(`wrote build/university/STATUS.md and university.json (${sum.units} units)`)
  return 0
}

cmds.contribute = ([study]) => {
  const r = contributionRoute(study)
  p(`CONTRIBUTION ROUTE - ${study}`)
  rule()
  p(`governed by: ${r.governed_by}`)
  p('\nAccepted only if:')
  for (const a of r.accepted_only_if) p(`  - ${a}`)
  p('\nRejected if:')
  for (const a of r.rejected_if) p(`  - ${a}`)
  p('\nRoute:')
  r.route.forEach((s, i) => p(`  ${i + 1}. ${s}`))
  p(`\n${r.note}`)
  return 0
}

const [cmd, ...args] = process.argv.slice(2)
if (!cmd || cmd === 'help' || cmd === '--help') {
  p(import.meta.url ? String(cmds.status.name && '') : '')
  console.log(`AI Lab University Engine

  node lib/university/university.mjs <command>

  status                  one screen
  graph                   competency graph + validation
  curriculum              units built from the corpus
  gaps                    what the curriculum is missing
  unit <id>               one unit in full
  lab <id>                the reproduction task
  research                Evidencing units from the Research Hub
  contribute <study>      the route a student contribution must take
  student [id]            standing, next proof tasks, graduation
  prove <id> <cap> <url>  accept a proof task
  assess <e> <h> <r>      score a post-mortem, 0-3 each
  project <competency>    project brief
  governance              integrity check
  report                  write build/university/`)
  process.exit(0)
}
if (!cmds[cmd]) { p(`unknown command '${cmd}'`); process.exit(2) }
try {
  process.exit(cmds[cmd](args) ?? 0)
} catch (e) {
  p(`error: ${e.message}`)
  process.exit(2)
}
