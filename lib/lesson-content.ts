/**
 * Server-only: reads lesson MDX files from disk.
 * Never import this in a 'use client' component.
 */
import fs from 'fs'
import path from 'path'

const LESSONS_ROOT = path.join(process.cwd(), 'content', 'lessons')

export function getLessonContent(
  trackId: string,
  moduleId: string,
  lessonId: string
): string | null {
  const mdxPath = path.join(LESSONS_ROOT, trackId, moduleId, `${lessonId}.mdx`)
  if (!fs.existsSync(mdxPath)) return null
  return fs.readFileSync(mdxPath, 'utf-8')
}
