/**
 * Academic governance and curriculum versioning.
 *
 * A certificate states what was demonstrated under a stated curriculum version.
 * Changing the curriculum must never silently revalue a credential already awarded, so
 * every issued certificate keeps the version it was assessed under.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadJson, DATA } from './corpus.mjs'

export const loadGovernance = () => loadJson('governance.json')

export function classifyChange({ graphChanged, graduationChanged, rubricChanged,
                                 unitAdded, capabilityAdded, corrected }) {
  if (graphChanged || graduationChanged || rubricChanged) {
    const why = [
      graphChanged && 'the competency graph changes',
      graduationChanged && 'graduation requirements change',
      rubricChanged && 'the assessment rubric changes',
    ].filter(Boolean).join('; ')
    return { class: 'major', why, requires: ['founder_approval'], notice: true }
  }
  if (unitAdded || capabilityAdded) {
    return { class: 'minor', why: 'curriculum extended', requires: ['curriculum_owner_approval'], notice: false }
  }
  if (corrected) {
    return { class: 'patch', why: 'correction with no change in what is assessed', requires: ['curriculum_owner_approval'], notice: false }
  }
  return { class: 'none', why: 'no governed change detected', requires: [], notice: false }
}

export function bump(version, cls) {
  const [maj, min, pat] = version.split('.').map(Number)
  if (cls === 'major') return `${maj + 1}.0.0`
  if (cls === 'minor') return `${maj}.${min + 1}.0`
  if (cls === 'patch') return `${maj}.${min}.${pat + 1}`
  return version
}

/** Governance checks that must hold before any certificate may be issued. */
export function integrityCheck(units, students) {
  const gov = loadGovernance()
  const rows = []
  const push = (rule, pass, detail = '') => rows.push({ rule, pass, detail })

  const approved = gov.approval_log.some(
    e => e.version === gov.curriculum_version && e.approved_by !== 'pending')
  push('curriculum version is approved', approved,
    approved ? '' : `v${gov.curriculum_version} approval is pending - no certificate may be issued`)

  const orphanUnits = units.filter(u => !u.beats.incident.present)
  push('no unit exists without a source document', orphanUnits.length === 0,
    orphanUnits.map(u => u.id).join(', '))

  const unclassified = units.filter(u => !u.competency)
  push('every unit maps to a competency', unclassified.length === 0,
    `${unclassified.length} unmapped or ambiguous`)

  const noVersion = students.filter(s => s.certified.length > 0 && !s.curriculum_version)
  push('every certified student records a curriculum version', noVersion.length === 0,
    noVersion.map(s => s.id).join(', '))

  const uncertifiedPortfolios = students.flatMap(s =>
    Object.entries(s.portfolios ?? {})
      .filter(([, p]) => p.state === 'certified' && !s.certified.includes(p.competency))
      .map(([k]) => `${s.id}:${k}`))
  push('no certificate without a portfolio', uncertifiedPortfolios.length === 0,
    uncertifiedPortfolios.join(', '))

  return { rows, ok: rows.every(r => r.pass), curriculum_version: gov.curriculum_version }
}

export function recordApproval(version, cls, summary, approvedBy) {
  const gov = loadGovernance()
  gov.approval_log.unshift({
    version, date: new Date().toISOString().slice(0, 10),
    class: cls, summary, approved_by: approvedBy,
  })
  gov.curriculum_version = version
  writeFileSync(join(DATA, 'governance.json'), JSON.stringify(gov, null, 2) + '\n', 'utf8')
  return `v${version} recorded as ${cls}, approved by ${approvedBy}`
}
