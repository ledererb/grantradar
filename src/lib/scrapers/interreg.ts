import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'interreg-ce'

/**
 * Scrape Interreg Central Europe calls for projects.
 */
export async function scrapeInterreg() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'Interreg Central Europe',
      slug: SOURCE_SLUG,
      url: 'https://www.interreg-central.eu',
      country: 'EU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 2 * * *',
    },
  })

  try {
    console.log('[Interreg CE] Scraping calls...')
    const doc = await scrapeGrantPage('https://www.interreg-central.eu/calls-for-proposals/')

    if (!doc?.markdown) {
      // Fallback
      const fallback = await scrapeGrantPage('https://www.interreg-central.eu/apply-for-funding/')
      if (!fallback?.markdown) {
        await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
        return { success: false, error: 'Empty page' }
      }
      Object.assign(doc || {}, fallback)
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract all calls for projects/proposals from this Interreg Central Europe page.

For each call, extract:
- code: call identifier (e.g. "1st Call", "2nd Call", or specific ID)
- title: full title
- status: "Open" / "Closed" / "Forthcoming"
- deadline: ISO date if shown, or null
- maxAmount: max funding per project in EUR as string, or null
- description: 1-2 sentence summary
- detailUrl: relative or absolute URL

Return JSON: { "grants": [...] }
Only include calls for project proposals, not events or news.

Page content:
${(doc?.markdown || '').slice(0, 15000)}`,
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return { success: false, error: 'No AI response' }

    const parsed = JSON.parse(content)
    const grants = parsed.grants || []
    console.log(`[Interreg CE] Extracted ${grants.length} calls`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const status = grant.status?.toLowerCase().includes('closed') ? 'CLOSED'
          : grant.status?.toLowerCase().includes('forthcoming') ? 'FORTHCOMING' : 'OPEN'
        if (status === 'CLOSED') continue

        const sourceUrl = grant.detailUrl?.startsWith('http') ? grant.detailUrl
          : grant.detailUrl ? `https://www.interreg-central.eu${grant.detailUrl}` 
          : 'https://www.interreg-central.eu/calls-for-proposals/'

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'Interreg Central Europe',
          status,
          deadline: grant.deadline || undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: ['Regionális fejlesztés', 'Innováció', 'Környezetvédelem'],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[Interreg CE] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[Interreg CE] Error:`, err)
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
