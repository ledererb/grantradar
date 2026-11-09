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
    status?: string[]
    sortStatus?: string[]
    keywords?: string[]
    description?: string[]
    identifier?: string[]
    budget?: string[]
    type?: string[]
  }
}

/**
 * Query the EU F&T SEDIA search API for active/forthcoming English SME-relevant calls.
 * SEDIA status codes:
 *   31094501 = Forthcoming
 *   31094502 = Open for submission
 *   31094503 = Closed
 */
async function searchEuCalls(query: string, pageSize = 30): Promise<EUResult[]> {
  const queryObj = {
    bool: {
      must: [
        { terms: { type: ['1', '2', '8'] } },
        { terms: { status: ['31094501', '31094502'] } },
      ],
    },
  }

  const form = new FormData()
  form.append('query', new Blob([JSON.stringify(queryObj)], { type: 'application/json' }))
  form.append('languages', new Blob([JSON.stringify(['en'])], { type: 'application/json' }))

  const res = await fetch(
    `${SEARCH_API}?apiKey=SEDIA&text=${encodeURIComponent(query)}&pageSize=${pageSize}&pageNumber=1`,
    { method: 'POST', body: form, next: { revalidate: 0 } },
  )

  if (!res.ok) throw new Error(`EU API returned ${res.status}`)
  const data = await res.json()
  return (data.results || []) as EUResult[]
}

/**
 * Map EU status / sortStatus to our GrantStatus.
 * In SEDIA:
 *   status 31094502 (sortStatus 1) = OPEN
 *   status 31094501 (sortStatus 2) = FORTHCOMING
 *   status 31094503 (sortStatus 3) = CLOSED
 */
export function mapEuStatus(statusCode?: string, sortStatus?: string): string {
  if (statusCode === '31094502') return 'OPEN'
  if (statusCode === '31094501') return 'FORTHCOMING'
  if (statusCode === '31094503') return 'CLOSED'
  if (sortStatus === '1') return 'OPEN'
  if (sortStatus === '2') return 'FORTHCOMING'
  if (sortStatus === '3') return 'CLOSED'
  return 'OPEN'
}

/**
 * Build valid EU Portal URL from SEDIA result.
 */
export function buildEuTopicUrl(result: EUResult): string {
  if (
    result.url &&
    result.url.startsWith(
      'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/',
    )
  ) {
    return result.url
  }

  const identifier =
    result.metadata?.identifier?.[0] ||
    result.metadata?.callIdentifier?.[0] ||
    result.reference.replace(/[a-z]{2}$/i, '')

  return `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier.toLowerCase()}`
}

/**
 * Extract clean text from HTML strings
 */
function stripHtml(html?: string): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Parse EU budget string to EUR number
 */
function parseBudget(budget?: string): number | null {
  if (!budget) return null
  const cleaned = budget.replace(/[^0-9.]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) || num <= 0 ? null : Math.round(num)
}

/**
 * Main EU scraper
 */
export async function scrapeEuPortal() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0
  const grantsUpdated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: {},
    create: {
      name: 'EU Funding & Tenders Portal',
      slug: SOURCE_SLUG,
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/',
      country: 'EU',
      crawlMethod: 'API',
      cronSchedule: '0 1 * * 1',
    },
  })

  try {
    const queries = [
      'SME innovation',
      'small business grant',
      'EIC accelerator',
      'digitalisation SME',
    ]
    const allResults: EUResult[] = []
    const seenIds = new Set<string>()

    for (const q of queries) {
      console.log(`[EU Portal] Searching: "${q}"...`)
      const results = await searchEuCalls(q, 25)
      for (const r of results) {
        const dedupId =
          r.metadata?.identifier?.[0] || r.metadata?.callIdentifier?.[0] || r.reference
        if (!seenIds.has(dedupId)) {
          seenIds.add(dedupId)
          allResults.push(r)
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }

    console.log(`[EU Portal] Found ${allResults.length} unique results`)
    const now = new Date()

    for (const result of allResults) {
      try {
        const meta = result.metadata
        const status = mapEuStatus(meta.status?.[0], meta.sortStatus?.[0])

        if (status === 'CLOSED') continue

        // Skip stale SEDIA entries whose deadlineDate has already passed
        const rawDeadline = meta.deadlineDate?.[0] || null
        if (rawDeadline) {
          const d = new Date(rawDeadline)
          if (!isNaN(d.getTime()) && d < now) continue
        }

        grantsFound++

        const title = meta.title?.[0] || meta.callTitle?.[0] || result.summary || 'EU Call'
        const code = meta.identifier?.[0] || meta.callIdentifier?.[0] || result.reference
        const description = stripHtml(meta.description?.[0]) || stripHtml(result.summary) || title
        const topicUrl = buildEuTopicUrl(result)
        const eurAmount = meta.budget?.[0] ? parseBudget(meta.budget[0]) : null

        await upsertGrant(source.id, {
          title,
          titleEn: title,
          code,
          program: meta.callTitle?.[0] || 'Horizon Europe / EU',
          status,
          deadline: rawDeadline ? rawDeadline.slice(0, 10) : null,
          openDate: meta.startDate?.[0] ? meta.startDate[0].slice(0, 10) : null,
          minAmountHuf: null,
          maxAmountHuf: eurAmount ? eurAmount * 400 : null,
          maxAmountEur: eurAmount,
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: meta.keywords || ['Innováció', 'K+F', 'EU közvetlen'],
          eligibleRegions: ['Országos', 'EU'],
          description,
          descriptionEn: description,
          documentUrls: [],
          sourceUrl: topicUrl,
          externalId: code,
        })

        grantsCreated++
        console.log(`[EU Portal] ✓ ${code}: ${title.slice(0, 50)}`)
      } catch (err) {
        console.error(`[EU Portal] Error: ${result.reference}`, err)
      }
    }

    const durationMs = Date.now() - startTime
    await logCrawlRun(source.id, 'SUCCESS', {
      grantsFound,
      grantsCreated,
      grantsUpdated,
      durationMs,
    })
    console.log(`[EU Portal] Done. Found: ${grantsFound}, Created: ${grantsCreated}. ${durationMs}ms`)
    return { success: true, grantsFound, grantsCreated }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await logCrawlRun(source.id, 'FAILED', {
      grantsFound,
      grantsCreated,
      grantsUpdated,
      durationMs,
      errorMessage,
    })
    console.error('[EU Portal] Fatal error:', error)
    return { success: false, error: errorMessage }
  }
}
