import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'pafi'

/**
 * Scrape pafi.hu — Hungarian grant aggregator / news portal.
 */
export async function scrapePafi() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'Pafi.hu (Pályázati Figyelő)',
      slug: SOURCE_SLUG,
      url: 'https://pafi.hu',
      country: 'HU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 4 * * *',
    },
  })

  try {
    console.log('[Pafi] Scraping palyazatok...')
    const doc = await scrapeGrantPage('https://pafi.hu/palyazatok')

    if (!doc?.markdown) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract ONLY business-relevant grants and funding opportunities from this pafi.hu page.
pafi.hu is a Hungarian grant aggregator — but it lists everything including art contests, student competitions, and cultural programs.

ONLY include items that are actual GRANTS or FUNDING OPPORTUNITIES (pályázat, támogatás):
- EU grants (Horizon, GINOP, DIMOP, KEHOP, etc.)
- National grants for any sector
- Business development grants
- R&D / innovation funding
- Investment support, loans, guarantees
- Municipal, agricultural, environmental grants
- Any programme where organizations can apply for funding

DO NOT include:
- Art contests, photography competitions ("fotópályázat")
- Student/youth competitions ("diák", "ifjúsági", "óvodai")
- Film festivals, cultural programs ("filmszemle", "művészeti")
- Literary/poetry competitions
- Individual mentor/scholarship programs

For each qualifying grant, extract:
- code: official code/identifier if shown
- title: full title in Hungarian
- status: "Aktív" / "Nyitott" / "Lezárt"
- deadline: ISO date if shown, or null
- maxAmount: max amount in HUF as string, or null
- description: 1-2 sentence summary
- detailUrl: relative URL to the detail page

Return JSON: { "grants": [...] }

Page content:
${doc.markdown.slice(0, 20000)}`,
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return { success: false, error: 'No AI response' }

    const parsed = JSON.parse(content)
    const grants = parsed.grants || []
    console.log(`[Pafi] Extracted ${grants.length} grants`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const status = grant.status?.toLowerCase().includes('lezárt') ? 'CLOSED' : 'OPEN'
        if (status === 'CLOSED') continue

        const sourceUrl = grant.detailUrl
          ? (grant.detailUrl.startsWith('http') ? grant.detailUrl : `https://pafi.hu${grant.detailUrl}`)
          : 'https://pafi.hu/palyazatok'

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: grant.program || 'Pályázat',
          status,
          deadline: grant.deadline || undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: grant.maxAmount ? parseInt(String(grant.maxAmount).replace(/[^0-9]/g, ''), 10) || null : null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: [],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[Pafi] ✓ ${grant.code || grant.title}`)
      } catch (err) {
        console.error(`[Pafi] Error:`, err)
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
