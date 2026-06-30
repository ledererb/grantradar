import { NextRequest, NextResponse } from 'next/server'
import { scrapePalyazatGovHu } from '@/lib/scrapers/palyazat-gov-hu'
import { autoEnrich, autoArchiveExpired } from '@/lib/scrapers/auto-enrich'

export const maxDuration = 300 // 5 min timeout for Vercel Pro

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await scrapePalyazatGovHu()
    const archived = await autoArchiveExpired()
    const enrichment = await autoEnrich(20)
    return NextResponse.json({ ...result, archived, enrichment })
  } catch (error) {
    console.error('[CRON] scrape-palyazat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Also allow GET for Vercel Cron
export async function GET(request: NextRequest) {
  return POST(request)
}
