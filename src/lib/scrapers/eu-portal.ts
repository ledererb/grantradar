import { prisma } from '@/lib/db'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'eu-funding-portal'
const SEARCH_API = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search'

interface EUResult {
  reference: string
  summary: string
  url: string
  metadata: {
    title?: string[]
    callTitle?: string[]
    callIdentifier?: string[]
    deadlineDate?: string[]
    startDate?: string[]
    sortStatus?: string[]
    keywords?: string[]
    description?: string[]
    identifier?: string[]
    budget?: string[]
    type?: string[]
  }
}

/**
 * Query the EU F&T SEDIA search API for SME-relevant calls
 */
async function searchEuCalls(query: string, pageSize = 50): Promise<EUResult[]> {
  const res = await fetch(
    `${SEARCH_API}?apiKey=SEDIA&text=${encodeURIComponent(query)}&pageSize=${pageSize}&pageNumber=1`,
    { method: 'POST', next: { revalidate: 0 } }
  )

  if (!res.ok) throw new Error(`EU API returned ${res.status}`)
  const data = await res.json()
  return (data.results || []) as EUResult[]
}

/**
 * Map EU sortStatus to our GrantStatus
 * 1 = forthcoming, 2 = open, 3 = closed
 */
function mapStatus(sortStatus?: string): string {
  if (sortStatus === '1') return 'FORTHCOMING'
  if (sortStatus === '2') return 'OPEN'
  if (sortStatus === '3') return 'CLOSED'
  return 'OPEN'
}

/**
 * Extract clean text from HTML strings
 */
function stripHtml(html?: string): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').trim()
}

/**
 * Parse EU budget string to EUR number
 */
function parseBudget(budget?: string): number | null {
  if (!budget) return null
  const cleaned = budget.replace(/[^0-9.]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : Math.round(num)
}

/**
 * Main EU scraper
 */
export async function scrapeEuPortal() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0
  let grantsUpdated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'EU Funding & Tenders Portal',
      slug: SOURCE_SLUG,
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/',
      country: 'EU',
      crawlMethod: 'API',
      cronSchedule: '0 1 * * *',
    },
  })

  try {
    // Search for SME-relevant open/forthcoming calls
    const queries = ['SME grant open', 'small business innovation', 'EIC accelerator', 'startup funding EU']
    const allResults: EUResult[] = []
    const seenRefs = new Set<string>()

    for (const q of queries) {
      console.log(`[EU Portal] Searching: "${q}"...`)
      const results = await searchEuCalls(q, 30)
      for (const r of results) {
        if (!seenRefs.has(r.reference)) {
          seenRefs.add(r.reference)
          allResults.push(r)
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log(`[EU Portal] Found ${allResults.length} unique results`)

    for (const result of allResults) {
      try {
        const meta = result.metadata
        const status = mapStatus(meta.sortStatus?.[0])

        // Skip closed calls
        if (status === 'CLOSED') continue

        grantsFound++

        const title = meta.callTitle?.[0] || meta.title?.[0] || result.summary || 'EU Call'
        const code = meta.identifier?.[0] || meta.callIdentifier?.[0] || result.reference
        const description = stripHtml(meta.description?.[0]) || stripHtml(result.summary)

        const topicUrl = `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${result.reference.replace(/en$/, '')}`

        const grant = await upsertGrant(source.id, {
          title,
          code,
          program: meta.title?.[0] || 'Horizon Europe',
          status,
          deadline: meta.deadlineDate?.[0] || null,
          openDate: meta.startDate?.[0] || null,
          minAmountHuf: null,
          maxAmountHuf: null,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: meta.keywords || [],
          description,
          documentUrls: [],
          sourceUrl: topicUrl,
        })

        // Set EUR amounts if available
        if (meta.budget?.[0]) {
          const eurAmount = parseBudget(meta.budget[0])
          if (eurAmount) {
            await prisma.grant.update({
              where: { id: grant.id },
              data: { maxAmountEur: eurAmount },
            })
          }
        }

        grantsCreated++
        console.log(`[EU Portal] ✓ ${code}`)
      } catch (err) {
        console.error(`[EU Portal] Error: ${result.reference}`, err)
      }
    }

    const durationMs = Date.now() - startTime
    await logCrawlRun(source.id, 'SUCCESS', { grantsFound, grantsCreated, grantsUpdated, durationMs })
    console.log(`[EU Portal] Done. Found: ${grantsFound}, Created: ${grantsCreated}. ${durationMs}ms`)
    return { success: true, grantsFound, grantsCreated }

  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await logCrawlRun(source.id, 'FAILED', { grantsFound, grantsCreated, grantsUpdated, durationMs, errorMessage })
    console.error('[EU Portal] Fatal error:', error)
    return { success: false, error: errorMessage }
  }
}
