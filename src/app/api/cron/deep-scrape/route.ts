import { NextRequest, NextResponse } from 'next/server'
import { deepScrapeGrants } from '@/lib/scrapers/deep-scrape'
import { runWithMonitoring } from '@/lib/scrapers/monitor'

export const maxDuration = 300

/**
 * Deep-scrape endpoint: follows grant detail page URLs and extracts
 * full eligibility, description, and application steps.
 * Processes 10 grants per run (rate limited by Firecrawl + GPT).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '10')

  try {
    // Reset failed scrapes if requested
    if (searchParams.get('reset') === 'true') {
      const { prisma } = await import('@/lib/db')
      const reset = await prisma.grant.updateMany({
        where: {
          detailScrapedAt: { not: null },
          eligibilityHu: null,
          status: { in: ['OPEN', 'FORTHCOMING'] },
        },
        data: { detailScrapedAt: null },
      })
      console.log(`[DeepScrape] Reset ${reset.count} failed scrapes`)
    }

    const { result, run } = await runWithMonitoring('deep-scrape', () => deepScrapeGrants(Math.min(limit, 20)))
    return NextResponse.json(result ?? { success: false, error: run.errors[0] || 'Deep scrape failed', monitoring: run })
  } catch (error) {
    console.error('[CRON] deep-scrape error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
