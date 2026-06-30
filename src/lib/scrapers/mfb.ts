import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'mfb'

/**
 * Scrape MFB (Magyar Fejlesztési Bank) loan products for businesses.
 */
export async function scrapeMfb() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'MFB (Magyar Fejlesztési Bank)',
      slug: SOURCE_SLUG,
      url: 'https://www.mfb.hu',
      country: 'HU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 4 * * *',
    },
  })

  try {
    // MFB has /vallalkozasok and /hitelek pages
    console.log('[MFB] Scraping /vallalkozasok...')
    const doc = await scrapeGrantPage('https://www.mfb.hu/vallalkozasok')

    const doc2 = await scrapeGrantPage('https://www.mfb.hu/hitelek')

    const combinedMarkdown = [doc?.markdown || '', doc2?.markdown || ''].join('\n\n---\n\n')

    if (combinedMarkdown.length < 100) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty pages' })
      return { success: false, error: 'Empty pages' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract all loan/credit/guarantee products for businesses from this MFB (Hungarian Development Bank) page.

For each product, extract:
- code: product identifier or short name
- title: full product name in Hungarian
- status: "Aktív" (assume active unless marked otherwise)
- fundingType: "LOAN" for credit products, "GUARANTEE" for guarantees
- maxAmount: max amount in HUF as string, or null
- description: 1-2 sentence summary
- detailUrl: relative URL path

Return JSON: { "grants": [...] }
Only include actual financial products for businesses, not corporate info.

Page content:
${combinedMarkdown.slice(0, 15000)}`,
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return { success: false, error: 'No AI response' }

    const parsed = JSON.parse(content)
    const grants = parsed.grants || []
    console.log(`[MFB] Extracted ${grants.length} products`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const sourceUrl = grant.detailUrl
          ? `https://www.mfb.hu${grant.detailUrl.startsWith('/') ? '' : '/'}${grant.detailUrl}`
          : 'https://www.mfb.hu/vallalkozasok'

        const maxAmount = grant.maxAmount ? parseInt(String(grant.maxAmount).replace(/[^0-9]/g, ''), 10) : null

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'MFB Hitelek',
          status: 'OPEN',
          fundingType: grant.fundingType || 'LOAN',
          deadline: undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: maxAmount && !isNaN(maxAmount) ? maxAmount : null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: [],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[MFB] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[MFB] Error:`, err)
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
