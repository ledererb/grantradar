import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'
import type { Country, CrawlMethod } from '@prisma/client'

interface ScraperConfig {
  slug: string
  name: string
  url: string
  scrapeUrl: string
  country: Country
  crawlMethod: CrawlMethod
  cronSchedule?: string
  extractionPrompt: string
  maxGrants?: number
}

interface ExtractedGrant {
  code: string
  title: string
  status: string
  fundingType?: string
  deadline?: string | null
  openDate?: string | null
  minAmount?: string | null
  maxAmount?: string | null
  supportIntensityPct?: number | null
  eligibleSizes?: string[]
  eligibleSectors?: string[]
  description?: string
  detailUrl?: string | null
}

/**
 * Parse Hungarian amount string to number
 */
function parseAmount(amountStr: string | null | undefined): number | null {
  if (!amountStr) return null
  const cleaned = amountStr.replace(/[^0-9]/g, '')
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? null : num
}

/**
 * Map status string to our enum
 */
function mapStatus(status: string): string {
  const s = status.toLowerCase().trim()
  if (s.includes('nyitott') || s.includes('aktív') || s.includes('open') || s.includes('elérhető')) return 'OPEN'
  if (s.includes('hamarosan') || s.includes('tervezett') || s.includes('forthcoming')) return 'FORTHCOMING'
  if (s.includes('lezárt') || s.includes('closed') || s.includes('lejárt')) return 'CLOSED'
  return 'OPEN'
}

/**
 * Generic scraper that uses Firecrawl + GPT extraction.
 * Configure with a ScraperConfig object.
 */
export async function runGenericScraper(config: ScraperConfig) {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0
  let grantsUpdated = 0

  const source = await prisma.source.upsert({
    where: { slug: config.slug },
    update: {},
    create: {
      name: config.name,
      slug: config.slug,
      url: config.url,
      country: config.country,
      crawlMethod: config.crawlMethod,
      cronSchedule: config.cronSchedule || '0 3 * * *',
    },
  })

  try {
    console.log(`[${config.name}] Scraping ${config.scrapeUrl}...`)
    const doc = await scrapeGrantPage(config.scrapeUrl)

    if (!doc?.markdown) {
      console.log(`[${config.name}] Could not scrape page`)
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    // Use GPT to extract grants
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `${config.extractionPrompt}

Page content:
${doc.markdown.slice(0, 15000)}`,
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'No AI response' })
      return { success: false, error: 'No AI response' }
    }

    const parsed = JSON.parse(content)
    const grants: ExtractedGrant[] = parsed.grants || []

    console.log(`[${config.name}] Extracted ${grants.length} grants`)

    for (const grant of grants.slice(0, config.maxGrants || 50)) {
      try {
        grantsFound++
        const status = mapStatus(grant.status)
        if (status === 'CLOSED') continue

        const sourceUrl = grant.detailUrl
          ? (grant.detailUrl.startsWith('http') ? grant.detailUrl : `${config.url}${grant.detailUrl}`)
          : config.scrapeUrl

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code,
          status,
          fundingType: grant.fundingType,
          deadline: grant.deadline || undefined,
          openDate: grant.openDate || undefined,
          minAmountHuf: parseAmount(grant.minAmount),
          maxAmountHuf: parseAmount(grant.maxAmount),
          supportIntensityPct: grant.supportIntensityPct,
          eligibleSizes: grant.eligibleSizes || [],
          eligibleSectors: grant.eligibleSectors || [],
          description: grant.description || grant.title,
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[${config.name}] ✓ ${grant.code}: ${grant.title}`)
      } catch (err) {
        console.error(`[${config.name}] Error: ${grant.code}`, err)
      }
    }

    const durationMs = Date.now() - startTime
    await logCrawlRun(source.id, 'SUCCESS', { grantsFound, grantsCreated, grantsUpdated, durationMs })
    console.log(`[${config.name}] Done. Found: ${grantsFound}, Created: ${grantsCreated}. ${durationMs}ms`)
    return { success: true, grantsFound, grantsCreated }

  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await logCrawlRun(source.id, 'FAILED', { grantsFound, grantsCreated, grantsUpdated, durationMs, errorMessage })
    console.error(`[${config.name}] Fatal error:`, error)
    return { success: false, error: errorMessage }
  }
}

// ─── SCRAPER CONFIGS ──────────────────────────────────

const EXTRACTION_PROMPT_BASE = `Extract all grant/pályázat/funding items from this page.
Return a JSON object with a "grants" array. Each grant should have:
- code: identifier/code (string)
- title: title (string)
- status: "Aktív"/"Nyitott"/"Lezárt"/"Hamarosan" (string)
- fundingType: "GRANT"/"LOAN"/"GUARANTEE"/"MIXED" (string)
- deadline: ISO date or null
- openDate: ISO date or null
- minAmount: minimum amount as string or null
- maxAmount: maximum amount as string or null
- supportIntensityPct: support percentage or null
- eligibleSizes: array from ["MICRO", "SMALL", "MEDIUM"]
- description: short summary (string)
- detailUrl: relative or absolute URL to detail page or null

ONLY include actual grants/funding programs, NOT news or announcements.`

export const SCRAPERS: Record<string, ScraperConfig> = {
  'nkfih': {
    slug: 'nkfih',
    name: 'NKFIH',
    url: 'https://nkfih.gov.hu',
    scrapeUrl: 'https://nkfih.gov.hu/palyazatok/aktualis-felhivasok',
    country: 'HU',
    crawlMethod: 'FIRECRAWL_SCRAPE',
    extractionPrompt: `${EXTRACTION_PROMPT_BASE}
This is the Hungarian National Research, Development and Innovation Office (NKFIH).
Focus on R&D and innovation grants for businesses.`,
  },
  'mfb': {
    slug: 'mfb',
    name: 'MFB (Magyar Fejlesztési Bank)',
    url: 'https://www.mfb.hu',
    scrapeUrl: 'https://www.mfb.hu/hitelek',
    country: 'HU',
    crawlMethod: 'FIRECRAWL_SCRAPE',
    extractionPrompt: `${EXTRACTION_PROMPT_BASE}
This is the Hungarian Development Bank (MFB). Products here are typically LOANS or GUARANTEES, not grants.
Set fundingType accordingly.`,
  },
  'kavosz': {
    slug: 'kavosz',
    name: 'KAVOSZ (Széchenyi Kártya)',
    url: 'https://kavosz.hu',
    scrapeUrl: 'https://kavosz.hu/szechenyi-kartya-program/',
    country: 'HU',
    crawlMethod: 'FIRECRAWL_SCRAPE',
    extractionPrompt: `${EXTRACTION_PROMPT_BASE}
This is KAVOSZ / Széchenyi Card Program. Products are typically LOANS for SMEs.
Set fundingType to LOAN for most items.`,
  },
  'hipa': {
    slug: 'hipa',
    name: 'HIPA (Befektetési Ügynökség)',
    url: 'https://hipa.hu',
    scrapeUrl: 'https://hipa.hu/incentives',
    country: 'HU',
    crawlMethod: 'FIRECRAWL_SCRAPE',
    extractionPrompt: `${EXTRACTION_PROMPT_BASE}
This is the Hungarian Investment Promotion Agency (HIPA).
Focus on investment incentives and grants for businesses.`,
  },
}

/** Run a specific scraper by slug */
export async function runScraper(slug: string) {
  const config = SCRAPERS[slug]
  if (!config) throw new Error(`Unknown scraper: ${slug}`)
  return runGenericScraper(config)
}

/** Run all scrapers sequentially */
export async function runAllScrapers() {
  const results: Record<string, { success: boolean; grantsFound?: number; grantsCreated?: number; error?: string }> = {}
  for (const [slug, config] of Object.entries(SCRAPERS)) {
    results[slug] = await runGenericScraper(config)
    await new Promise(resolve => setTimeout(resolve, 2000)) // Rate limit between scrapers
  }
  return results
}
