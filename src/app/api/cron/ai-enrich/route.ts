import { NextRequest, NextResponse } from 'next/server'
import { autoEnrich, autoArchiveExpired } from '@/lib/scrapers/auto-enrich'
import { runWithMonitoring } from '@/lib/scrapers/monitor'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const archived = await autoArchiveExpired()
    const { result, run } = await runWithMonitoring('ai-enrich', () => autoEnrich(20))

    if (run.status === 'error') {
      return NextResponse.json(
        { error: run.errors[0] || 'AI enrich failed', monitoring: run },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      archived,
      ...(result ?? { processed: 0, enriched: 0 }),
      monitoring: run,
    })
  } catch (error) {
    console.error('[CRON] ai-enrich error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
