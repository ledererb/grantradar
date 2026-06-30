import { NextRequest, NextResponse } from 'next/server'
import { scrapeEuPortal } from '@/lib/scrapers/eu-portal'
import { autoEnrich, autoArchiveExpired } from '@/lib/scrapers/auto-enrich'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await scrapeEuPortal()
    const archived = await autoArchiveExpired()
    const enrichment = await autoEnrich(20)
    return NextResponse.json({ ...result, archived, enrichment })
  } catch (error) {
    console.error('[CRON] scrape-eu error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
