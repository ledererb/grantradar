import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'magyarfaluprogram'

/**
 * Scrape magyarfaluprogram.hu — Magyar Falu Program
 * Village development grants for micro/small businesses in small settlements.
 */
export async function scrapeMagyarFalu() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'Magyar Falu Program',
      slug: SOURCE_SLUG,
      url: 'https://magyarfaluprogram.hu',
      country: 'HU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 3 * * 1',
    },
  })

  try {
    console.log('[MagyarFalu] Scraping...')
    const doc = await scrapeGrantPage('https://magyarfaluprogram.hu')

    if (!doc?.markdown || doc.markdown.length < 300) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract all active grant calls from this Magyar Falu Program page.
The Magyar Falu Program supports small settlements (under 5000 inhabitants) with grants for:
- Business development (Vállalkozás újraindítása, Falusi kisbolt)
- Infrastructure, public services, road development
- Community and cultural development

For each grant, extract:
- code: official code (e.g. "MFP-VÚ/2026", "MFP-FKB/2026") or short identifier
- title: full title in Hungarian
- status: "Aktív" / "Pályázható" / "Lezárt"
- deadline: ISO date or null
- maxAmount: maximum amount in HUF as string, or null
- description: 1-2 sentence summary
- detailUrl: URL or null

Return JSON: { "grants": [...] }
Only include grants that businesses or municipalities can currently apply for.

Content:
${doc.markdown.slice(0, 25000)}`,
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return { success: false, error: 'No AI response' }

    const parsed = JSON.parse(content)
    const grants = parsed.grants || []
    console.log(`[MagyarFalu] Extracted ${grants.length} grants`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const status = grant.status?.toLowerCase().includes('lezárt') ? 'CLOSED' : 'OPEN'
        if (status === 'CLOSED') continue

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'Magyar Falu Program',
          status,
          deadline: grant.deadline || undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: grant.maxAmount ? parseInt(String(grant.maxAmount).replace(/[^0-9]/g, ''), 10) || null : null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL'],
          eligibleSectors: ['Vidékfejlesztés', 'Kisvállalkozás', 'Önkormányzat'],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl: grant.detailUrl || 'https://magyarfaluprogram.hu',
        })
        grantsCreated++
        console.log(`[MagyarFalu] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[MagyarFalu] Error:`, err)
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
