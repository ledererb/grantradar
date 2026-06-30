import { prisma } from '@/lib/db'
import { scrapeGrantPage } from '@/lib/firecrawl'
import { openai } from '@/lib/openai'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'ofa'

export async function scrapeOfa() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'OFA (Országos Foglalkoztatási Nonprofit)',
      slug: SOURCE_SLUG,
      url: 'https://ofa.hu',
      country: 'HU',
      crawlMethod: 'FIRECRAWL_SCRAPE',
      cronSchedule: '0 4 * * *',
    },
  })

  try {
    // OFA homepage has project slider with active grants
    console.log('[OFA] Scraping homepage...')
    const doc = await scrapeGrantPage('https://ofa.hu')

    if (!doc?.markdown || doc.markdown.length < 200) {
      await logCrawlRun(source.id, 'FAILED', { grantsFound: 0, grantsCreated: 0, grantsUpdated: 0, durationMs: Date.now() - startTime, errorMessage: 'Empty page' })
      return { success: false, error: 'Empty page' }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Extract all active grant/funding projects from this OFA (Országos Foglalkoztatási Közhasznú Nonprofit Kft) homepage.
OFA manages EU-funded employment and training programmes in Hungary.

For each project/grant, extract:
- code: official code (e.g. "GINOP_PLUSZ-3.2.6-25")
- title: full project title in Hungarian
- status: "Aktív" (assume active)
- description: 1-2 sentence summary
- detailUrl: URL to the project page if available

Return JSON: { "grants": [...] }
Only include actual projects/grants, not general org info.

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
    console.log(`[OFA] Extracted ${grants.length} projects`)

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const sourceUrl = grant.detailUrl?.startsWith('http') ? grant.detailUrl
          : grant.detailUrl ? `https://ofa.hu${grant.detailUrl}`
          : 'https://ofa.hu'

        await upsertGrant(source.id, {
          title: grant.title || grant.code,
          code: grant.code || grant.title?.slice(0, 40),
          program: 'OFA / GINOP Plusz',
          status: 'OPEN',
          deadline: undefined,
          openDate: undefined,
          minAmountHuf: null,
          maxAmountHuf: null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: ['Foglalkoztatás', 'Képzés', 'Szociális'],
          description: grant.description || '',
          documentUrls: [],
          sourceUrl,
        })
        grantsCreated++
        console.log(`[OFA] ✓ ${grant.code}`)
      } catch (err) {
        console.error(`[OFA] Error:`, err)
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
