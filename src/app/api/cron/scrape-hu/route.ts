import { NextRequest, NextResponse } from 'next/server'
import { scrapeNkfih } from '@/lib/scrapers/nkfih'
import { scrapeKavosz } from '@/lib/scrapers/kavosz'
import { scrapeEic } from '@/lib/scrapers/eic'
import { scrapeInterreg } from '@/lib/scrapers/interreg'
import { scrapeMfb } from '@/lib/scrapers/mfb'
import { scrapePafi } from '@/lib/scrapers/pafi'
import { scrapeHipa } from '@/lib/scrapers/hipa'
import { scrapeEureka } from '@/lib/scrapers/eureka'
import { scrapeKap } from '@/lib/scrapers/kap'
import { scrapeMagyarFalu } from '@/lib/scrapers/magyarfalu'
import { scrapeNffku } from '@/lib/scrapers/nffku'
import { autoEnrich, autoArchiveExpired } from '@/lib/scrapers/auto-enrich'

export const maxDuration = 300

type ScraperFn = () => Promise<{ success: boolean; grantsFound?: number; grantsCreated?: number; error?: string }>

/**
 * Tiered scraper schedule — concrete grants only.
 * 
 * FAST  (Mon+Thu): pafi, eureka
 * STD   (Monday):  nkfih, eic, kap, magyarfalu, nffku
 * SLOW  (1st+15th): kavosz, mfb, hipa, interreg
 * 
 * Dropped: EU Commission (programme categories, not concrete calls), EEN (matchmaking), OFA (no grant pages)
 */

const FAST: Record<string, ScraperFn> = {
  pafi: scrapePafi,
  eureka: scrapeEureka,
}

const STANDARD: Record<string, ScraperFn> = {
  nkfih: scrapeNkfih,
  eic: scrapeEic,
  kap: scrapeKap,
  magyarfalu: scrapeMagyarFalu,
  nffku: scrapeNffku,
}

const SLOW: Record<string, ScraperFn> = {
  kavosz: scrapeKavosz,
  mfb: scrapeMfb,
  hipa: scrapeHipa,
  interreg: scrapeInterreg,
}

const ALL: Record<string, ScraperFn> = { ...FAST, ...STANDARD, ...SLOW }

function getTierForToday(): Record<string, ScraperFn> {
  const now = new Date()
  const dow = now.getUTCDay()
  const dom = now.getUTCDate()
  if (dow === 1) {
    const scrapers = { ...FAST, ...STANDARD }
    if (dom <= 2 || (dom >= 15 && dom <= 16)) Object.assign(scrapers, SLOW)
    return scrapers
  }
  if (dow === 4) return FAST
  if (dom === 1 || dom === 15) return { ...FAST, ...SLOW }
  return {}
}

async function runScrapers(scrapers: Record<string, ScraperFn>) {
  const results: Record<string, unknown> = {}
  for (const [name, scraper] of Object.entries(scrapers)) {
    try {
      results[name] = await scraper()
    } catch (e) {
      results[name] = { success: false, error: e instanceof Error ? e.message : 'Unknown' }
    }
    await new Promise(resolve => setTimeout(resolve, 1500))
  }
  return results
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('source')
  const tier = searchParams.get('tier')

  let scrapers: Record<string, ScraperFn>

  if (slug) {
    const fn = ALL[slug]
    if (!fn) {
      return NextResponse.json({ error: `Unknown: ${slug}`, available: Object.keys(ALL) }, { status: 400 })
    }
    const result = await fn()
    const enrichResult = await autoEnrich(10)
    return NextResponse.json({ ...result, enrichment: enrichResult })
  }

  if (tier === 'all') scrapers = ALL
  else if (tier === 'fast') scrapers = FAST
  else if (tier === 'standard') scrapers = STANDARD
  else if (tier === 'slow') scrapers = SLOW
  else scrapers = getTierForToday()

  if (Object.keys(scrapers).length === 0) {
    return NextResponse.json({ skipped: true, reason: 'No scrapers scheduled today' })
  }

  console.log(`[Cron] Running ${Object.keys(scrapers).length} scrapers: ${Object.keys(scrapers).join(', ')}`)
  const results = await runScrapers(scrapers)
  const archived = await autoArchiveExpired()
  const enrichResult = await autoEnrich(20)

  return NextResponse.json({ scrapers: results, archived, enrichment: enrichResult })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
