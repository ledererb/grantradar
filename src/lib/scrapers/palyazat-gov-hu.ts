import { prisma } from '@/lib/db'
import { upsertGrant, logCrawlRun } from './shared'

const SOURCE_SLUG = 'palyazat-gov-hu'
// Aktív status GUID (stable UUID from palyazat.gov.hu's filter system)
const ACTIVE_STATUS_GUID = 'b2111a67-2c8c-49c9-abdc-01ee1abb1814'
const BASE_URL = `https://www.palyazat.gov.hu/palyazatok/palyazatkereso?palyazatStatusza=${ACTIVE_STATUS_GUID}`

/**
 * Tender data structure from palyazat.gov.hu's embedded __NEXT_DATA__ payload.
 * The site is a Next.js app that serializes its Redux store (tendersApiSlice)
 * into the initial HTML, giving us clean structured JSON for free.
 */
interface PalyazatTender {
  code: string
  name: string
  id: string
  status: string
  minSupportAmount: number
  maxSupportAmount: number
  startTime: string    // ISO date
  endTime: string      // ISO date
  formOfSupport: string
  rateOfSupport: number
  developmentalProgram: string
  operationalProgram: string
  categories: string[]
  beneficiaries: string[]
  supportPurpose?: string
  conditionsOfSupport?: string
  sumAvailableSupportAmount?: number
  sumRequestedSupportAmount?: number
  modificationTime?: string
  released?: number
}

/**
 * Fetch one page of active grants from palyazat.gov.hu.
 * Parses the __NEXT_DATA__ script tag to extract the Redux store.
 */
async function fetchPage(page: number): Promise<{ tenders: PalyazatTender[], totalCount: number }> {
  const url = `${BASE_URL}&page=${page}`
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrantRadar/1.0)' },
  })

  if (!resp.ok) throw new Error(`HTTP ${resp.status} for page ${page}`)

  const html = await resp.text()

  // Extract __NEXT_DATA__ JSON using indexOf (regex escaping is fragile across build targets)
  const startMarker = '<script id="__NEXT_DATA__" type="application/json">'
  const endMarker = '</script>'
  const startIdx = html.indexOf(startMarker)
  if (startIdx === -1) throw new Error(`No __NEXT_DATA__ found on page ${page}`)
  const jsonStart = startIdx + startMarker.length
  const jsonEnd = html.indexOf(endMarker, jsonStart)
  if (jsonEnd === -1) throw new Error(`No closing script tag for __NEXT_DATA__ on page ${page}`)
  const jsonStr = html.substring(jsonStart, jsonEnd)

  const nextData = JSON.parse(jsonStr)
  const initialState = JSON.parse(nextData.props?.pageProps?.initialState || '{}')

  // Find the getTenders query result in the Redux store
  const queries = initialState.tendersApiSlice?.queries || {}
  for (const [key, val] of Object.entries(queries)) {
    if (key.includes('getTenders')) {
      const data = (val as { data?: { tenders: PalyazatTender[], pagination: { totalCount: number } } }).data
      if (data) {
        return {
          tenders: data.tenders || [],
          totalCount: data.pagination?.totalCount || 0,
        }
      }
    }
  }

  return { tenders: [], totalCount: 0 }
}

/**
 * Fetch ALL active grants across all pages.
 */
async function fetchAllActiveTenders(): Promise<PalyazatTender[]> {
  const { tenders: firstPage, totalCount } = await fetchPage(1)
  console.log(`[palyazat.gov.hu] API: ${totalCount} total active grants`)

  const all: PalyazatTender[] = [...firstPage]
  const totalPages = Math.ceil(totalCount / 10)

  for (let page = 2; page <= totalPages; page++) {
    try {
      const { tenders } = await fetchPage(page)
      if (tenders.length === 0) break
      all.push(...tenders)
      console.log(`[palyazat.gov.hu] Page ${page}: +${tenders.length} (total: ${all.length})`)
    } catch (err) {
      console.error(`[palyazat.gov.hu] Page ${page} failed:`, err)
      break
    }
  }

  return all
}

/**
 * Map support form string to our FundingType enum.
 */
function mapFundingType(form: string): string {
  const f = form.toLowerCase()
  if (f.includes('hitel') || f.includes('pénzügyi eszköz')) return 'LOAN'
  if (f.includes('garancia')) return 'GUARANTEE'
  if (f.includes('visszatérítendő') && !f.includes('nem')) return 'LOAN'
  if (f.includes('vegyes') || f.includes('kombinált')) return 'MIXED'
  return 'GRANT'
}

/**
 * Check if a tender is relevant for businesses (SMB filter).
 */
function isBusinessRelevant(tender: PalyazatTender): boolean {
  const allCats = [...tender.beneficiaries, ...tender.categories].map(s => s.toLowerCase())

  // Must have at least one business-type beneficiary
  const businessTerms = ['vállalkozás', 'kkv', 'mikro', 'kis- és közepes']
  return allCats.some(cat => businessTerms.some(term => cat.includes(term)))
}

/**
 * Build the detail page URL from tender metadata.
 */
function buildDetailUrl(tender: PalyazatTender): string {
  const program = encodeURIComponent(tender.developmentalProgram || '')
  const op = encodeURIComponent(tender.operationalProgram || '')
  const code = encodeURIComponent(tender.code || '')
  return `https://www.palyazat.gov.hu/palyazatok/redirect?program=${program}&op=${op}&code=${code}`
}

/**
 * Extract eligible company sizes from beneficiaries/categories.
 */
function extractSizes(tender: PalyazatTender): string[] {
  const text = [...tender.beneficiaries, ...tender.categories].join(' ').toLowerCase()
  const sizes: string[] = []
  if (text.includes('mikro') || text.includes('vállalkozás')) sizes.push('MICRO')
  if (text.includes('kis') || text.includes('vállalkozás')) sizes.push('SMALL')
  if (text.includes('közép') || text.includes('közepes') || text.includes('vállalkozás')) sizes.push('MEDIUM')
  return sizes.length > 0 ? sizes : ['MICRO', 'SMALL', 'MEDIUM']
}

/**
 * Extract sector tags from categories.
 */
function extractSectors(tender: PalyazatTender): string[] {
  const sectors: string[] = []
  const cats = tender.categories.map(c => c.toLowerCase())

  const sectorMap: Record<string, string> = {
    'energia': 'Energia',
    'digitalizáció': 'Digitalizáció',
    'közlekedés': 'Közlekedés',
    'egészség': 'Egészségügy',
    'k+f': 'Kutatás-fejlesztés',
    'innováció': 'Innováció',
    'turisztika': 'Turizmus',
    'élelmiszeripar': 'Élelmiszeripar',
    'mezőgazdaság': 'Mezőgazdaság',
    'környezetvédelem': 'Környezetvédelem',
    'foglalkoztatás': 'Foglalkoztatás',
    'képzés': 'Képzés',
    'vállalkozás': 'Vállalkozásfejlesztés',
  }

  for (const cat of cats) {
    for (const [keyword, label] of Object.entries(sectorMap)) {
      if (cat.includes(keyword) && !sectors.includes(label)) {
        sectors.push(label)
      }
    }
  }

  // Add program as sector if nothing else matched
  if (sectors.length === 0 && tender.supportPurpose) {
    sectors.push(tender.supportPurpose.slice(0, 50))
  }

  return sectors
}

/**
 * Main scraper: fetch all active grants from palyazat.gov.hu via __NEXT_DATA__.
 * Zero Firecrawl cost, zero GPT cost — pure HTTP + JSON parsing.
 */
export async function scrapePalyazatGovHu() {
  const startTime = Date.now()
  let grantsFound = 0
  let grantsCreated = 0
  const grantsUpdated = 0

  const source = await prisma.source.upsert({
    where: { slug: SOURCE_SLUG },
    update: { crawlMethod: 'API' },
    create: {
      name: 'palyazat.gov.hu',
      slug: SOURCE_SLUG,
      url: 'https://palyazat.gov.hu',
      country: 'HU',
      crawlMethod: 'API',
      cronSchedule: '0 3 * * 1',
    },
  })

  try {
    const tenders = await fetchAllActiveTenders()
    console.log(`[palyazat.gov.hu] Fetched ${tenders.length} active grants`)

    for (const tender of tenders) {
      try {
        grantsFound++


        const sourceUrl = buildDetailUrl(tender)

        await upsertGrant(source.id, {
          title: tender.name,
          code: tender.code,
          program: tender.operationalProgram || tender.developmentalProgram || undefined,
          status: 'OPEN',
          fundingType: mapFundingType(tender.formOfSupport),
          deadline: tender.endTime?.slice(0, 10) || null,
          openDate: tender.startTime?.slice(0, 10) || null,
          minAmountHuf: tender.minSupportAmount || null,
          maxAmountHuf: tender.maxSupportAmount || null,
          supportIntensityPct: tender.rateOfSupport || null,
          eligibleSizes: extractSizes(tender),
          eligibleSectors: extractSectors(tender),
          description: `${tender.name}. Támogatási forma: ${tender.formOfSupport}. Program: ${tender.developmentalProgram} / ${tender.operationalProgram}. Támogatási intenzitás: ${tender.rateOfSupport}%.`,
          documentUrls: [],
          sourceUrl,
          externalId: tender.code || tender.id || sourceUrl,
        })

        grantsCreated++
        console.log(`[palyazat.gov.hu] ✓ ${tender.code}: ${tender.name.slice(0, 50)}`)
      } catch (err) {
        console.error(`[palyazat.gov.hu] Error on ${tender.code}:`, err)
      }
    }

    const durationMs = Date.now() - startTime
    await logCrawlRun(source.id, 'SUCCESS', {
      grantsFound, grantsCreated, grantsUpdated, durationMs,
    })

    console.log(`[palyazat.gov.hu] Done. Found: ${grantsFound}, Business-relevant: ${grantsCreated}. ${durationMs}ms`)
    return { success: true, grantsFound, grantsCreated }

  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await logCrawlRun(source.id, 'FAILED', {
      grantsFound, grantsCreated, grantsUpdated, durationMs, errorMessage,
    })
    console.error('[palyazat.gov.hu] Fatal error:', error)
    return { success: false, error: errorMessage }
  }
}
