// GET /api/distribution/export?id=<bundleId>&format=markdown|html|json&locale=en|hi
import { NextResponse } from 'next/server'
import { getBundle } from '@/lib/distribution/engine'
import { exportBundle } from '@/lib/distribution/export'
import type { ExportFormat, Locale } from '@/lib/distribution/types'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const MIME: Record<ExportFormat, string> = {
  markdown: 'text/markdown; charset=utf-8',
  html: 'text/html; charset=utf-8',
  json: 'application/json; charset=utf-8',
}

export async function GET(req: Request) {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const id = sp.get('id')
  const format = (sp.get('format') as ExportFormat) || 'markdown'
  const locale = (sp.get('locale') as Locale) || 'en'
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const bundle = await getBundle(id)
  if (!bundle) return NextResponse.json({ error: 'bundle not found' }, { status: 404 })

  const out = exportBundle(bundle, format, locale)
  return new NextResponse(out, {
    headers: {
      'content-type': MIME[format],
      'content-disposition': `attachment; filename="${id}.${format === 'markdown' ? 'md' : format}"`,
    },
  })
}
