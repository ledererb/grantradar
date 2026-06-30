import { NextRequest, NextResponse } from 'next/server'
import { scrapeEuPortal } from '@/lib/scrapers/eu-portal'
import { autoEnrich, autoArchiveExpired } from '@/lib/scrapers/auto-enrich'
import { runWithMonitoring } from '@/lib/scrapers/monitor'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { result, run } = await runWithMonitoring('eu-portal', scrapeEuPortal)

  if (run.status === 'error') {
    return NextResponse.json(
      { error: run.errors[0] || 'Scraper failed', monitoring: run },
      { status: 500 }
    )
  }

  try {
    const archived = await autoArchiveExpired()
    const enrichment = await autoEnrich(20)
    return NextResponse.json({ ...(result ?? {}), monitoring: run, archived, enrichment })
  } catch (error) {
    console.error('[CRON] scrape-eu post-processing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', monitoring: run },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
