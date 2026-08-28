/**
 * Progress tracking.
 *
 * `lib/progress.ts` already owns lesson completion (localStorage, per browser, per
 * track). This module does NOT duplicate it and does not read localStorage.
 *
 * The distinction is deliberate and is the architecture's own: completing a lesson is
 * EXPOSURE, not attainment. The University refuses completion percentages and streaks,
 * so lesson progress can never advance a competency. Only a proven capability or a
 * certified portfolio does that.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const STUDENTS = join(import.meta.dirname, '..', 'state', 'students')

/** Progress signals, ranked. Only the last two change standing. */
export const SIGNALS = {
  exposure: {
    owner: 'lib/progress.ts',
    meaning: 'lessons marked complete in the browser',
    advances_competency: false,
    note: 'Read-only input. Never evidence of attainment.',
  },
  reproduction: {
    owner: 'university',
    meaning: 'a failure reproduced deliberately, with the log',
    advances_competency: false,
  },
  capability: {
    owner: 'university',
    meaning: 'a proof task accepted',
    advances_competency: true,
  },
  certification: {
    owner: 'university',
    meaning: 'a portfolio accepted for a competency',
    advances_competency: true,
  },
}

export function newStudent(id) {
  return {
    id,
    created: new Date().toISOString().slice(0, 10),
    curriculum_version: null,
    proven_capabilities: [],
    certified: [],
    reproductions: [],
    portfolios: {},
    live_system_days: 0,
    accepted_contribution: null,
    external_postmortem: null,
    history: [],
  }
}

export function loadStudent(id) {
  const p = join(STUDENTS, `${id}.json`)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : newStudent(id)
}

export function saveStudent(s) {
  mkdirSync(STUDENTS, { recursive: true })
  writeFileSync(join(STUDENTS, `${s.id}.json`), JSON.stringify(s, null, 2) + '\n', 'utf8')
}

export function allStudents() {
  if (!existsSync(STUDENTS)) return []
  return readdirSync(STUDENTS)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(STUDENTS, f), 'utf8')))
}

export function record(student, kind, detail) {
  student.history.push({ date: new Date().toISOString().slice(0, 10), kind, detail })
  return student
}

/** Prove a capability. The proof artefact is required - a claim alone is not proof. */
export function proveCapability(student, capabilityId, artifact, curriculumVersion) {
  if (!artifact) throw new Error('a proof task requires an artefact - a claim is not proof')
  if (!student.proven_capabilities.includes(capabilityId)) {
    student.proven_capabilities.push(capabilityId)
  }
  student.curriculum_version ??= curriculumVersion
  return record(student, 'capability', { capability: capabilityId, artifact })
}

export function certify(student, competency, curriculumVersion, evidence) {
  if (!student.certified.includes(competency)) student.certified.push(competency)
  return record(student, 'certification', {
    competency,
    curriculum_version: curriculumVersion,
    evidence,
    note: 'certificate records the curriculum version in force at assessment',
  })
}
