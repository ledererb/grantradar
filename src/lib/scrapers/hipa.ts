import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'hipa'

export async function scrapeHipa() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'HIPA (Befektetési Ügynökség)',
      slug: SOURCE_SLUG,
      url: 'https://hipa.hu',
      country: 'HU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 4 * * *',
    },
  })

  try {
    console.log('[HIPA] Scraping via Firecrawl...')
    const doc = await scrapeGrantPage('https://hipa.hu/main')

    if (!doc?.markdown || doc.markdown.length < 200) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract all investment incentives, grants, and funding programs from this HIPA (Hungarian Investment Promotion Agency) page.

For each incentive/grant, extract:
- code: identifier or short name
- title: full name
- status: "Aktív" (assume active)
- fundingType: "GRANT" or "MIXED"
- description: 1-2 sentence summary
- detailUrl: relative URL or null

Return JSON: { "grants": [...] }
Only include actual investment incentives or funding programs.

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
    console.log(`[HIPA] Extracted ${grants.length} items`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const sourceUrl = grant.detailUrl
          ? `https://hipa.hu${grant.detailUrl.startsWith('/') ? '' : '/'}${grant.detailUrl}`
          : 'https://hipa.hu/main'

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'HIPA Investment Incentives',
          status: 'OPEN',
          fundingType: grant.fundingType || 'GRANT',
          deadline: undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: ['Befektetés', 'Ipar'],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[HIPA] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[HIPA] Error:`, err)
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
