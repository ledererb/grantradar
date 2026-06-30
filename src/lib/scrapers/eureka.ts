import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'eureka'

export async function scrapeEureka() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'EUREKA / Eurostars',
      slug: SOURCE_SLUG,
      url: 'https://www.eurekanetwork.org',
      country: 'EU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 2 * * *',
    },
  })

  try {
    console.log('[EUREKA] Scraping open calls...')
    const doc = await scrapeGrantPage('https://www.eurekanetwork.org/open-calls')

    if (!doc?.markdown || doc.markdown.length < 200) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract ONLY actual R&D funding calls from this EUREKA page.
EUREKA offers collaborative R&D funding through programmes like Eurostars, Eureka Clusters (CELTIC-NEXT, EUROGIA, ITEA, Xecs, etc.), Globalstars, and Network Projects.

ONLY include items that are actual FUNDING CALLS where companies can apply for R&D grants.
DO NOT include:
- Corporate events or online sessions ("Online Session", "Webinar")
- Startup challenges or competitions ("Startup Challenge", "Challenge Application")
- Investor matchmaking events
- Information sessions

For each funding call, extract:
- code: call identifier (e.g. "Eurostars-3 Cut-off 14", "EUROGIA2030 Call 30")
- title: full title
- status: "Open" / "Closed" / "Forthcoming"
- deadline: ISO date if shown, or null
- maxAmount: max funding in EUR as string, or null
- description: 1-2 sentence summary of what R&D projects it funds
- detailUrl: relative or absolute URL

Return JSON: { "grants": [...] }

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
    console.log(`[EUREKA] Extracted ${grants.length} calls`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const status = grant.status?.toLowerCase().includes('closed') ? 'CLOSED'
          : grant.status?.toLowerCase().includes('forthcoming') ? 'FORTHCOMING' : 'OPEN'
        if (status === 'CLOSED') continue

        const sourceUrl = grant.detailUrl?.startsWith('http') ? grant.detailUrl
          : grant.detailUrl ? `https://www.eurekanetwork.org${grant.detailUrl}`
          : 'https://www.eurekanetwork.org/open-calls'

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'EUREKA / Eurostars',
          status,
          deadline: grant.deadline || undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: ['K+F', 'Innováció', 'Technológia'],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[EUREKA] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[EUREKA] Error:`, err)
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
