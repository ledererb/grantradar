import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'eu-commission'

/**
 * Scrape EC funding programmes page — comprehensive list of all EU funding.
 */
export async function scrapeEuCommission() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'Európai Bizottság (EU Programmes)',
      slug: SOURCE_SLUG,
      url: 'https://commission.europa.eu/funding-tenders/find-funding/eu-funding-programmes_hu',
      country: 'EU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 2 * * 1',
    },
  })

  try {
    console.log('[EU Commission] Scraping funding programmes...')
    const doc = await scrapeGrantPage('https://commission.europa.eu/funding-tenders/find-funding/eu-funding-programmes_hu')

    if (!doc?.markdown || doc.markdown.length < 500) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract all EU funding programmes listed on this European Commission page.
This is the official list of EU funding programmes that businesses and organizations can apply for.

For each programme, extract:
- code: short code or abbreviation (e.g. "Horizon Europe", "COSME", "LIFE", "CEF", "InvestEU", "ERDF")
- title: full title (in Hungarian if available, otherwise English)
- description: 1-2 sentence summary of what the programme funds
- detailUrl: link to the programme detail page

Return JSON: { "grants": [...] }
Only include programmes that provide actual funding (grants, loans, guarantees).
Skip informational pages or general EU governance topics.

Content:
${doc.markdown.slice(0, 20000)}`,
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return { success: false, error: 'No AI response' }

    const parsed = JSON.parse(content)
    const grants = parsed.grants || []
    console.log(`[EU Commission] Extracted ${grants.length} programmes`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const sourceUrl = grant.detailUrl?.startsWith('http') ? grant.detailUrl
          : grant.detailUrl ? `https://commission.europa.eu${grant.detailUrl}`
          : 'https://commission.europa.eu/funding-tenders/find-funding/eu-funding-programmes_hu'

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'EU Funding Programmes',
          status: 'OPEN',
          deadline: undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM', 'LARGE'],
          eligibleSectors: [],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[EU Commission] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[EU Commission] Error:`, err)
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
