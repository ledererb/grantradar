import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'eic'

/**
 * Scrape EIC (European Innovation Council) funding opportunities.
 * EIC has 3 main instruments: Pathfinder, Transition, Accelerator.
 */
export async function scrapeEic() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'EIC (European Innovation Council)',
      slug: SOURCE_SLUG,
      url: 'https://eic.ec.europa.eu',
      country: 'EU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 2 * * *',
    },
  })

  try {
    // Scrape the main funding opportunities page
    console.log('[EIC] Scraping funding opportunities...')
    const doc = await scrapeGrantPage('https://eic.ec.europa.eu/eic-funding-opportunities_en')

    if (!doc?.markdown) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract all current EIC (European Innovation Council) funding calls/programmes from this page.
The main instruments are: EIC Pathfinder, EIC Transition, EIC Accelerator, and special challenges.

For each call/instrument, extract:
- code: identifier (e.g. "EIC-ACCELERATOR-2026", "EIC-PATHFINDER-OPEN-2026")
- title: full name
- status: "Open" / "Forthcoming" / "Closed"
- deadline: ISO date if shown, or null
- maxAmount: maximum funding in EUR as string, or null  
- description: 1-2 sentence summary of what it funds
- detailUrl: relative URL to the detail page (starting with /)

Return JSON: { "grants": [...] }
Only include actual funding calls, not general info pages.

Page content:
${doc.markdown.slice(0, 15000)}`,
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return { success: false, error: 'No AI response' }

    const parsed = JSON.parse(content)
    const grants = parsed.grants || []
    console.log(`[EIC] Extracted ${grants.length} calls`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const status = grant.status?.toLowerCase().includes('closed') ? 'CLOSED'
          : grant.status?.toLowerCase().includes('forthcoming') ? 'FORTHCOMING' : 'OPEN'
        if (status === 'CLOSED') continue

        const sourceUrl = grant.detailUrl
          ? `https://eic.ec.europa.eu${grant.detailUrl.startsWith('/') ? '' : '/'}${grant.detailUrl}`
          : 'https://eic.ec.europa.eu/eic-funding-opportunities_en'

        const maxEur = grant.maxAmount ? parseInt(String(grant.maxAmount).replace(/[^0-9]/g, ''), 10) : null

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'European Innovation Council',
          status,
          deadline: grant.deadline || undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: ['Innováció', 'Deep Tech', 'Startup'],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl,
        })

        // Set EUR amount
        if (maxEur && !isNaN(maxEur)) {
          await prisma.grant.update({
            where: { sourceId_externalId: { sourceId: source.id, externalId: grant.code || sourceUrl } },
            data: { maxAmountEur: maxEur },
          })
        }

        grantsCreated++
        console.log(`[EIC] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[EIC] Error:`, err)
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
