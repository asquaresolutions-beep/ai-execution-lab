import { NextResponse } from 'next/server'
import { buildSearchIndex } from '@/lib/search-index'

export const dynamic = 'force-dynamic'

export function GET() {
  try {
    const index = buildSearchIndex()
    return NextResponse.json(index)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
