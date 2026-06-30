import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'nffku'

/**
 * Scrape nffku.hu — Nemzeti Fejlesztési és Klímaügyi Központ (Modernizációs Alap)
 * Energy, environment, and climate grants from the Modernisation Fund.
 */
export async function scrapeNffku() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'NFFKÜ (Modernizációs Alap)',
      slug: SOURCE_SLUG,
      url: 'https://nffku.hu',
      country: 'HU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 3 * * 1',
    },
  })

  try {
    console.log('[NFFKÜ] Scraping homepage...')
    const doc = await scrapeGrantPage('https://nffku.hu')

    if (!doc?.markdown || doc.markdown.length < 300) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract all active grant/funding programmes from this NFFKÜ (Nemzeti Fejlesztési és Klímaügyi Központ) page.
NFFKÜ manages the Modernisation Fund — energy efficiency, renewables, and climate grants.

The page has "tiles" linking to individual programmes. Each tile represents a grant programme.
Extract those that are marked as "megjelent" (published/active). Skip "archív" (archived) ones.

For each programme, extract:
- code: short identifier derived from the programme name
- title: full title in Hungarian
- status: "Aktív" (if megjelent) or "Archív"
- description: what the programme funds (1-2 sentences)
- detailUrl: link to the detail page (relative or absolute)

Return JSON: { "grants": [...] }

Content:
${doc.markdown.slice(0, 15000)}`,
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return { success: false, error: 'No AI response' }

    const parsed = JSON.parse(content)
    const grants = parsed.grants || []
    console.log(`[NFFKÜ] Extracted ${grants.length} programmes`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        if (grant.status?.toLowerCase().includes('archív')) continue

        const sourceUrl = grant.detailUrl?.startsWith('http') ? grant.detailUrl
          : grant.detailUrl ? `https://nffku.hu${grant.detailUrl}`
          : 'https://nffku.hu'

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'Modernizációs Alap',
          status: 'OPEN',
          deadline: undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM', 'LARGE'],
          eligibleSectors: ['Energia', 'Megújuló', 'Klíma', 'Környezetvédelem'],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[NFFKÜ] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[NFFKÜ] Error:`, err)
      }
    }

    const durationMs = Date.now() - startTime
    await logCrawlRun(source.id, 'SUCCESS', { grantsFound, grantsCreated, grantsUpdated: 0, durationMs })
    return { success: true, grantsFound, grantsCreated }

  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await logCrawlRun(source.id, 'FAILED', { grantsFound, grantsCreated, grantsUpdated: 0, durationMs, errorMessage })
    return { success: false, error: errorMessage }
  }
}
