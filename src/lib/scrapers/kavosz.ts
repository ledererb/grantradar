import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'kavosz'

/**
 * Scrape KAVOSZ Széchenyi Card Program loan products.
 * These are mostly SME loan programs, not grants.
 */
export async function scrapeKavosz() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'KAVOSZ (Széchenyi Kártya)',
      slug: SOURCE_SLUG,
      url: 'https://www.kavosz.hu',
      country: 'HU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 4 * * *',
    },
  })

  try {
    console.log('[KAVOSZ] Scraping /hitelek/...')
    const doc = await scrapeGrantPage('https://www.kavosz.hu/hitelek/')

    if (!doc?.markdown) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract all loan/credit products from this KAVOSZ / Széchenyi Card Program page.
For each product, extract:
- code: product name/identifier (e.g. "Széchenyi Kártya Folyószámlahitel MAX+")
- title: full product name in Hungarian
- status: "Aktív" (assume active unless stated otherwise)
- fundingType: "LOAN" for all products
- maxAmount: maximum loan amount as string (e.g. "300000000") or null
- description: 1-2 sentence product summary
- detailUrl: the relative URL path to the detail page

Return JSON: { "grants": [...] }
ONLY include actual financial products, not news or contact info.

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
    const grants = parsed.grants || []
    console.log(`[KAVOSZ] Extracted ${grants.length} products`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const sourceUrl = grant.detailUrl
          ? `https://www.kavosz.hu${grant.detailUrl.startsWith('/') ? '' : '/'}${grant.detailUrl}`
          : 'https://www.kavosz.hu/hitelek/'

        const maxAmount = grant.maxAmount ? parseInt(String(grant.maxAmount).replace(/[^0-9]/g, ''), 10) : null

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'Széchenyi Kártya Program',
          status: 'OPEN',
          fundingType: 'LOAN',
          deadline: undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: maxAmount && !isNaN(maxAmount) ? maxAmount : null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: [],
          description: grant.description || grant.title || '',
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[KAVOSZ] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[KAVOSZ] Error:`, err)
      }
    }

    const durationMs = Date.now() - startTime
    await logCrawlRun(source.id, 'SUCCESS', { grantsFound, grantsCreated, grantsUpdated: 0, durationMs })
    console.log(`[KAVOSZ] Done. Found: ${grantsFound}, Created: ${grantsCreated}. ${durationMs}ms`)
    return { success: true, grantsFound, grantsCreated }

  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await logCrawlRun(source.id, 'FAILED', { grantsFound, grantsCreated, grantsUpdated: 0, durationMs, errorMessage })
    console.error('[KAVOSZ] Fatal error:', error)
    return { success: false, error: errorMessage }
  }
}
