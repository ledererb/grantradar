import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'nkfih'

/**
 * Scrape NKFIH (National Research, Development and Innovation Office) grant calls.
 * The listing page at /palyazoknak has links to individual calls.
 * We first scrape the listing, then follow links to get details.
 */
export async function scrapeNkfih() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'NKFIH',
      slug: SOURCE_SLUG,
      url: 'https://nkfih.gov.hu',
      country: 'HU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 4 * * *',
    },
  })

  try {
    // Scrape the aktális felhívások listing — richest grant listing page
    console.log('[NKFIH] Scraping aktuális felhívások...')
    const doc = await scrapeGrantPage('https://nkfih.gov.hu/palyazoknak/palyazatok/aktualis-felhivasok')

    if (!doc?.markdown || doc.markdown.length < 300) {
      console.log('[NKFIH] Fallback to /palyazoknak...')
      const fallback = await scrapeGrantPage('https://nkfih.gov.hu/palyazoknak')
      if (!fallback?.markdown) {
        await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
        return { success: false, error: 'Empty page' }
      }
      Object.assign(doc || {}, fallback)
    }

    // Extract grant call links and info via GPT
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract all active grant/funding calls ("pályázati felhívás") from this NKFIH page.
For each grant, extract:
- code: the official identifier code (e.g. "2025-1.1.5-EU-KP", "GINOP_PLUSZ-2.1.4-25")
- title: full title in Hungarian
- status: "Aktív" or "Lezárt" or "Hamarosan"
- deadline: ISO date if visible, or null
- description: 1-2 sentence summary
- detailUrl: the relative URL path to the detail page (starting with /)

Return JSON: { "grants": [...] }
ONLY include real grant/funding calls. Skip navigation items, news, and general info.

Page content:
${(doc?.markdown || '').slice(0, 60000)}`,
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
    console.log(`[NKFIH] Extracted ${grants.length} grants`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const status = grant.status?.toLowerCase().includes('lezárt') ? 'CLOSED'
          : grant.status?.toLowerCase().includes('hamarosan') ? 'FORTHCOMING' : 'OPEN'
        if (status === 'CLOSED') continue

        const sourceUrl = grant.detailUrl
          ? `https://nkfih.gov.hu${grant.detailUrl.startsWith('/') ? '' : '/'}${grant.detailUrl}`
          : 'https://nkfih.gov.hu/palyazoknak'

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 30),
          program: 'NKFI Alap',
          status,
          deadline: grant.deadline || undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: ['Kutatás-fejlesztés', 'Innováció'],
          description: grant.description || grant.title || '',
          documentUrls: [],
          sourceUrl,
          externalId: grant.code || sourceUrl,
        })
        grantsCreated++
        console.log(`[NKFIH] ✓ ${grant.code}: ${grant.title}`)
      } catch (err) {
        console.error(`[NKFIH] Error:`, err)
      }
    }

    const durationMs = Date.now() - startTime
    await logCrawlRun(source.id, 'SUCCESS', { grantsFound, grantsCreated, grantsUpdated: 0, durationMs })
    console.log(`[NKFIH] Done. Found: ${grantsFound}, Created: ${grantsCreated}. ${durationMs}ms`)
    return { success: true, grantsFound, grantsCreated }

  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await logCrawlRun(source.id, 'FAILED', { grantsFound, grantsCreated, grantsUpdated: 0, durationMs, errorMessage })
    console.error('[NKFIH] Fatal error:', error)
    return { success: false, error: errorMessage }
  }
}
