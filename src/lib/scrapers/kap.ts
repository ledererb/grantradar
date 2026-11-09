import { prisma } from '@/lib/db'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'kap-gov-hu'
const SEARCH_URL = 'https://kap.gov.hu/rest/app/search'
const PAGINATE_URL = 'https://kap.gov.hu/rest/app/paginate'

interface KapSearchResponse {
  ok: boolean
  data: {
    total: number
    start: number
    length: number
    cursor: string
    docs: string[] // HTML snippets
  }
}

export interface ParsedKapCard {
  code: string | null
  title: string
  status: 'Aktív' | 'Lezárult' | 'Felfüggesztve' | null
  detailUrl: string | null
  minAmount: string | null
  maxAmount: string | null
  supportForm: string | null
  startDate: string | null
  endDate: string | null
}

/**
 * Parse a single grant card HTML snippet from the KAP REST API.
 * Each doc is a raw HTML string like:
 *   <div class="pbitem"><div class="pbtitle">Title - KAP-RD01-1-25</div>...
 */
export function parseGrantCard(html: string): ParsedKapCard {
  // Title: <div class="pbtitle">Erdőtelepítés - KAP-RD38-RD39-1-25</div>
  const titleMatch = html.match(/pbtitle">\s*(.*?)\s*</)
  const rawTitle = titleMatch?.[1]?.trim() || ''

  // Code: KAP-RDxx-xx-xx pattern
  const codeMatch = rawTitle.match(/(KAP-[A-Za-z0-9_-]+)/)
  const code = codeMatch?.[1] || null

  // Clean title: remove the code suffix
  const title = code
    ? rawTitle.replace(/\s*-\s*KAP-[A-Za-z0-9_-]+$/, '').replace(code, '').trim()
    : rawTitle

  // Status: Aktív / Lezárult / Felfüggesztve
  const statusMatch = html.match(/(Aktív|Lezárult|Felfüggesztve)/)
  const status = (statusMatch?.[1] as 'Aktív' | 'Lezárult' | 'Felfüggesztve') || null

  // Detail URL: either <a href="/tamogatas/..."> or onclick="window.open('/tamogatas/...', '_self');"
  const urlMatch =
    html.match(/href="(\/tamogatas\/[^"]+)"/) ||
    html.match(/window\.open\(['"](\/tamogatas\/[^'"]+)['"]/)
  const detailUrl = urlMatch?.[1] || null

  // Min amount: after "Támogatás minimum összege</label>"
  const minMatch = html.match(/minimum összege<\/label>([^<]+)/)
  const minAmount = minMatch?.[1]?.trim() || null

  // Max amount: after "Támogatás maximum összege</label>"
  const maxMatch = html.match(/maximum összege<\/label>([^<]+)/)
  const maxAmount = maxMatch?.[1]?.trim() || null

  // Support form: after "Támogatás formája</label>"
  const formMatch = html.match(/formája<\/label>([^<]+)/)
  const supportForm = formMatch?.[1]?.trim() || null

  // Dates: "2025-01-27 <img src="/themes/kap/images/arrow.png"> 2025-03-13" or "2025-01-27 → 2025-03-13"
  const dateMatch = html.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:→|<img[^>]*>)\s*(\d{4}-\d{2}-\d{2})/i,
  )
  const startDate = dateMatch?.[1] || null
  const endDate = dateMatch?.[2] || null

  return { code, title, status, detailUrl, minAmount, maxAmount, supportForm, startDate, endDate }
}

/**
 * Parse amount string like "1 500 000 Ft", "50.000 eurónak megfelelő forintösszeg", or "nincs megadva" → HUF number or null
 */
export function parseKapAmountHuf(str: string | null): number | null {
  if (!str) return null
  const lower = str.toLowerCase().trim()
  if (lower === 'nincs megadva' || lower === '-' || lower === '') return null

  const cleaned = str.replace(/[^0-9]/g, '')
  const num = parseInt(cleaned, 10)
  if (isNaN(num) || num === 0) return null

  // Convert EUR amounts (e.g. "50.000 eurónak megfelelő forintösszeg") to approximate HUF
  if (lower.includes('eur') || lower.includes('€')) {
    return num * 400
  }

  return num
}

/**
 * Map support form string to our FundingType
 */
function mapFundingType(form: string | null): string {
  if (!form) return 'GRANT'
  const f = form.toLowerCase()
  if (f.includes('hitel') || f.includes('pénzügyi eszköz')) return 'LOAN'
  if (f.includes('garancia')) return 'GUARANTEE'
  if (f.includes('vegyes') || f.includes('kombinált')) return 'MIXED'
  return 'GRANT'
}

/**
 * Fetch all grants from the KAP REST API (search returns start=0, paginate uses start=1..N).
 */
async function fetchAllGrants(): Promise<ParsedKapCard[]> {
  const searchBody = JSON.stringify({
    search: '',
    kk: '0',
    tf: '0',
    fc: '0',
    tm: null,
    st: '',
    order: 'desc',
  })

  const searchResp = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: searchBody,
  })

  if (!searchResp.ok) throw new Error(`KAP search failed: ${searchResp.status}`)

  const searchData: KapSearchResponse = await searchResp.json()
  const { cursor, total, docs: firstDocs } = searchData.data

  console.log(`[KAP] API returned ${total} total grants`)

  const allDocs = [...firstDocs]

  // Paginate through remaining pages (start=1 corresponds to offset 10)
  const totalPages = Math.ceil(total / 10)
  for (let page = 1; page <= totalPages; page++) {
    try {
      const pageResp = await fetch(PAGINATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor, start: page }),
      })

      if (!pageResp.ok) break

      const pageData: KapSearchResponse = await pageResp.json()
      if (!pageData.ok) break
      const docs = pageData.data?.docs || []
      if (docs.length === 0) break

      allDocs.push(...docs)
    } catch {
      console.error(`[KAP] Pagination failed on page ${page}`)
      break
    }
  }

  const parsed = allDocs.map(parseGrantCard)
  // Deduplicate overlapping items across pages
  const seen = new Set<string>()
  const unique: ParsedKapCard[] = []
  for (const card of parsed) {
    const key = card.code || card.detailUrl || card.title
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(card)
  }

  console.log(`[KAP] Collected ${unique.length} unique grant cards`)
  return unique
}

/**
 * Main scraper: fetch all KAP grants via REST API and upsert.
 */
export async function scrapeKap() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0
  let grantsUpdated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: { crawlMethod: 'API' },
    create: {
      name: 'KAP (Közös Agrárpolitika)',
      slug: SOURCE_SLUG,
      url: 'https://kap.gov.hu',
      country: 'HU',
      crawlMethod: 'API',
      cronSchedule: '0 3 * * 1',
    },
  })

  try {
    const grants = await fetchAllGrants()

    for (const grant of grants) {
      try {
        if (!grant.code && !grant.title) continue
        grantsFound++

        const status =
          grant.status === 'Lezárult' || grant.status === 'Felfüggesztve'
            ? 'CLOSED'
            : 'OPEN'

        // If a grant closed or was suspended, transition any existing OPEN/FORTHCOMING record to CLOSED
        // so users don't see closed calls as active AND future re-openings are properly detected.
        if (status === 'CLOSED') {
          if (grant.code) {
            const closedUpdate = await prisma.grant.updateMany({
              where: {
                sourceId: source.id,
                code: grant.code,
                status: { in: ['OPEN', 'FORTHCOMING'] },
              },
              data: {
                status: 'CLOSED',
                updatedAt: new Date(),
              },
            })
            grantsUpdated += closedUpdate.count
          }
          continue
        }

        const sourceUrl = grant.detailUrl
          ? `https://kap.gov.hu${grant.detailUrl}`
          : 'https://kap.gov.hu'

        await upsertGrant(source.id, {
          title: grant.title || grant.code || 'N/A',
          code: grant.code || grant.title?.slice(0, 40),
          program: 'Közös Agrárpolitika (KAP)',
          status,
          fundingType: mapFundingType(grant.supportForm),
          deadline: grant.endDate || undefined,
          openDate: grant.startDate || undefined,
          minAmountHuf: parseKapAmountHuf(grant.minAmount),
          maxAmountHuf: parseKapAmountHuf(grant.maxAmount),
          supportIntensityPct: null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: ['Mezőgazdaság', 'Agrár', 'Vidékfejlesztés', 'Élelmiszeripar'],
          description: `${grant.title}. Támogatási forma: ${grant.supportForm || 'VNT'}. Program: KAP Stratégiai Terv.${grant.startDate && grant.endDate ? ` Beadási időszak: ${grant.startDate} – ${grant.endDate}.` : ''}`,
          documentUrls: [],
          sourceUrl,
          externalId: grant.code || sourceUrl,
        })

        grantsCreated++
        console.log(`[KAP] ✓ ${grant.code}: ${grant.title?.slice(0, 50)}`)
      } catch (err) {
        console.error(`[KAP] Error on ${grant.code}:`, err)
      }
    }

    const durationMs = Date.now() - startTime
    await logCrawlRun(source.id, 'SUCCESS', {
      grantsFound,
      grantsCreated,
      grantsUpdated,
      durationMs,
    })
    console.log(`[KAP] Done. Found: ${grantsFound}, Active: ${grantsCreated}, Closed-updated: ${grantsUpdated}. ${durationMs}ms`)
    return { success: true, grantsFound, grantsCreated, grantsUpdated }
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
    console.error('[KAP] Fatal error:', error)
    return { success: false, error: errorMessage }
  }
}
