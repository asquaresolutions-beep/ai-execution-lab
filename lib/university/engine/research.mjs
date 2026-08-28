/**
 * Research integration.
 *
 * The University and the Research Hub share one evidence base. Every published study
 * becomes an Evidencing unit; advanced students contribute to real datasets under
 * RESEARCH_STANDARD.
 *
 * This module READS the research repository. Research and the ROS are frozen - nothing
 * here writes to them, and no research rule is reimplemented. Student contributions are
 * governed by RESEARCH_STANDARD.md and pass through the ROS correction/review
 * workflows, not through this engine.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Configurable because the research repo lives on a different volume. */
export const RESEARCH_ROOT = process.env.ASQUARE_RESEARCH_ROOT
  ?? 'D:/ClaudeCode/asquare-work/asquare-research'
export const RESEARCH_OS = process.env.ASQUARE_RESEARCH_OS
  ?? 'D:/ClaudeCode/asquare-work/research-os'

function readJson(p) {
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
}

/** The manifest records confidence as a rating plus its argument. Take the rating. */
function shortConfidence(value) {
  if (!value) return null
  const m = String(value).match(/^(HIGH|MEDIUM|LOW|LOW-MEDIUM|MEDIUM-HIGH)\b/i)
  return m ? m[1].toUpperCase() : String(value).slice(0, 12)
}

export function researchAvailable() {
  return existsSync(join(RESEARCH_OS, 'STUDY_MANIFEST.json'))
}

/**
 * Evidencing units, one per study.
 *
 * A study only becomes a unit when it is safe to teach from. A study carrying an open
 * correction is listed but not teachable: teaching a number that is being corrected
 * would propagate the defect into every student who cites it.
 */
export function evidencingUnits() {
  const manifest = readJson(join(RESEARCH_OS, 'STUDY_MANIFEST.json'))
  if (!manifest) {
    return { available: false, reason: `research repo not found at ${RESEARCH_OS}`, units: [] }
  }
  const rosStatus = readJson(join(RESEARCH_ROOT, 'build', 'ros', 'status.json'))
  const byId = new Map((rosStatus?.studies ?? []).map(s => [s.id, s]))

  const units = manifest.studies.map(s => {
    const ops = byId.get(s.id)
    const openCorrections = ops?.open_corrections ?? []
    const stage = ops?.stage ?? 'unknown'
    const nLimitations = (s.limitations ?? []).length
    // A study is teachable only if it is actually published, carries no open
    // correction, and states at least one limitation. An unpublished study has not
    // cleared its own gates - teaching from it would put students ahead of the
    // evidence, which is the opposite of what an Evidencing unit is for.
    const reasons = []
    if (stage !== 'published') reasons.push(`not published - stage is '${stage}'`)
    if (openCorrections.length) {
      reasons.push(`open correction ${openCorrections.join(', ')} - teaching a number under correction propagates the defect`)
    }
    if (nLimitations === 0) reasons.push('no stated limitation')

    return {
      id: `study-${s.id}`,
      study: s.id,
      title: s.title,
      competency: 'evidencing',
      claim: s.headline_claim,
      confidence: shortConfidence(s.confidence),
      limitations: nLimitations,
      stage,
      open_corrections: openCorrections,
      teachable: reasons.length === 0,
      not_teachable_because: reasons.length ? reasons.join('; ') : null,
      beats: {
        incident: { source: null, present: false, note: 'evidencing units open on the question, not a failure' },
        principle: { source: 'RESEARCH_STANDARD.md', present: true },
        practice: {
          source: `studies/${s.id}/METHODOLOGY.md`,
          present: existsSync(join(RESEARCH_ROOT, 'studies', s.id, 'METHODOLOGY.md')),
          gap: 'methodology not documented - the study cannot be repeated by a student',
        },
        proof: { source: null, present: false, produced_by: 'student dataset contribution' },
      },
    }
  })
  return { available: true, units }
}

/**
 * A student contribution to a real dataset. Returns the route it must take - it does
 * not perform it, because the ROS owns that workflow and is frozen.
 */
export function contributionRoute(studyId) {
  return {
    study: studyId,
    governed_by: 'RESEARCH_STANDARD.md',
    accepted_only_if: [
      'states what was measured and over what period',
      'states sample size and why it is adequate',
      'states at least one limitation',
      'states what observation would have falsified the conclusion',
    ],
    rejected_if: ['no dataset', 'not reproducible from the published files', 'stated more strongly than the evidence supports'],
    route: [
      'student opens a contribution against the research repository',
      'ROS records it as a review or correction (ros review / ros correction raise)',
      'if accepted, the student is credited in the study CHANGELOG',
      'graduation requirement "corpus_contribution" is satisfied by that acceptance',
    ],
    note: 'This engine does not write to the research repo. Acceptance is recorded in the ROS.',
  }
}
