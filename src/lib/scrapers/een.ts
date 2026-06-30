import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'een'

export async function scrapeEen() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'Enterprise Europe Network',
      slug: SOURCE_SLUG,
      url: 'https://een.ec.europa.eu',
      country: 'EU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 2 * * *',
    },
  })

  try {
    console.log('[EEN] Scraping events/calls...')
    const doc = await scrapeGrantPage('https://een.ec.europa.eu/events')

    if (!doc?.markdown || doc.markdown.length < 200) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract business matchmaking and brokerage events from this Enterprise Europe Network page.
EEN events help SMEs find partners for EU-funded projects (Horizon Europe, COSME, etc).

For each event, extract:
- code: event identifier or short name
- title: full title  
- status: "Open" (if upcoming) / "Closed" (if past)
- deadline: registration deadline as ISO date, or event date if no deadline
- description: 1-2 sentence summary including what business sector it targets
- detailUrl: relative or absolute URL

Return JSON: { "grants": [...] }
Only include brokerage events, matchmaking events, and partner search calls. Skip webinars and general info.

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
    console.log(`[EEN] Extracted ${grants.length} items`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const status = grant.status?.toLowerCase().includes('closed') ? 'CLOSED'
          : grant.status?.toLowerCase().includes('forthcoming') ? 'FORTHCOMING' : 'OPEN'
        if (status === 'CLOSED') continue

        const sourceUrl = grant.detailUrl?.startsWith('http') ? grant.detailUrl
          : grant.detailUrl ? `https://een.ec.europa.eu${grant.detailUrl}`
          : 'https://een.ec.europa.eu/events'

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'Enterprise Europe Network',
          status,
          deadline: grant.deadline || undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: ['Nemzetközi üzletfejlesztés', 'EU pályázatok'],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[EEN] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[EEN] Error:`, err)
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
