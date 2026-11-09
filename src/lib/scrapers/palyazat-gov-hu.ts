import https from 'node:https'
import { prisma } from '@/lib/db'
import { upsertGrant, logCrawlRun } from './shared'

/**
 * Fetch helper that falls back to Node https.request with rejectUnauthorized: false
 * when Vercel/Linux Node CA store lacks the Hungarian government Microsec e-Szigno CA.
 */
async function govFetchText(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const resp = await fetch(url, {
      method: options?.method || 'GET',
      headers: options?.headers,
      body: options?.body,
    })
    return { ok: resp.ok, status: resp.status, text: await resp.text() }
  } catch (err) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url)
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method: options?.method || 'GET',
          headers: options?.headers,
          rejectUnauthorized: false,
          timeout: 20000,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(Buffer.from(c)))
          res.on('end', () => {
            const status = res.statusCode || 500
            resolve({
              ok: status >= 200 && status < 300,
              status,
              text: Buffer.concat(chunks).toString('utf8'),
            })
          })
        },
      )
      req.on('error', () => reject(err))
      if (options?.body) req.write(options.body)
      req.end()
    })
  }
}

const SOURCE_SLUG = 'palyazat-gov-hu'
// Aktív status GUID (stable UUID from palyazat.gov.hu's filter system)
const ACTIVE_STATUS_GUID = 'b2111a67-2c8c-49c9-abdc-01ee1abb1814'
const BASE_URL = `https://www.palyazat.gov.hu/palyazatok/palyazatkereso?palyazatStatusza=${ACTIVE_STATUS_GUID}`
const FAIR_API_BASE = 'https://ginapp-api.fair.gov.hu'

const HUNGARIAN_REGIONS = [
  'Közép-Magyarország',
  'Budapest',
  'Pest',
  'Közép-Dunántúl',
  'Nyugat-Dunántúl',
  'Dél-Dunántúl',
  'Észak-Magyarország',
  'Észak-Alföld',
  'Dél-Alföld',
]

/**
 * Tender data structure from palyazat.gov.hu / ginapp-api.fair.gov.hu.
 */
interface PalyazatTender {
  code: string
  name: string
  id: string
  status: string
  minSupportAmount: number
  maxSupportAmount: number
  startTime: string // ISO date
  endTime: string // ISO date
  formOfSupport: string
  rateOfSupport: number
  developmentalProgram: string
  operationalProgram: string
  categories: string[]
  beneficiaries: string[]
  supportPurpose?: string
  conditionsOfSupport?: string
  wayOfAcquiringSupport?: { id?: string; name?: string }
  sumAvailableSupportAmount?: number
  sumRequestedSupportAmount?: number
  modificationTime?: string
  released?: number
}

/**
 * Fetch active tenders directly from the official FairApp JSON API (`ginapp-api.fair.gov.hu`).
 */
async function fetchViaDirectApi(): Promise<PalyazatTender[]> {
  const all: PalyazatTender[] = []
  const pageSize = 100
  let pageIndex = 0
  let totalCount = Infinity

  while (all.length < totalCount && pageIndex < 20) {
    const resp = await govFetchText(`${FAIR_API_BASE}/papi/tenders/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'application-name': 'FairApp',
        'device-id': '40b0c32c-77fe-4380-9f5e-be96ae24fabd',
      },
      body: JSON.stringify({
        filtering: {
          exactFilters: [{ selected: [ACTIVE_STATUS_GUID], type: 'Status' }],
        },
        pagination: { pageIndex, pageSize },
        sort: { direction: 'desc', field: 'endTime' },
      }),
    })

    if (!resp.ok) {
      throw new Error(`FairApp API returned HTTP ${resp.status}`)
    }

    const data = JSON.parse(resp.text) as {
      tenders?: PalyazatTender[]
      pagination?: { totalCount?: number }
    }
    const tenders = data.tenders || []
    totalCount = data.pagination?.totalCount ?? tenders.length
    if (tenders.length === 0) break

    all.push(...tenders)
    pageIndex++
  }

  return all
}

/**
 * Fallback: Fetch one page of active grants from palyazat.gov.hu HTML `__NEXT_DATA__`.
 */
async function fetchPage(page: number): Promise<{ tenders: PalyazatTender[]; totalCount: number }> {
  const url = `${BASE_URL}&page=${page}`
  const resp = await govFetchText(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrantRadar/1.0)' },
  })

  if (!resp.ok) throw new Error(`HTTP ${resp.status} for page ${page}`)

  const html = resp.text

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

  const queries = initialState.tendersApiSlice?.queries || {}
  for (const [key, val] of Object.entries(queries)) {
    if (key.includes('getTenders')) {
      const data = (val as { data?: { tenders: PalyazatTender[]; pagination: { totalCount: number } } }).data
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
 * Fetch ALL active grants across all pages (prefers direct JSON API, falls back to __NEXT_DATA__).
 */
async function fetchAllActiveTenders(): Promise<PalyazatTender[]> {
  try {
    const directTenders = await fetchViaDirectApi()
    if (directTenders.length > 0) {
      console.log(`[palyazat.gov.hu] Direct FairApp API returned ${directTenders.length} active grants`)
      return directTenders
    }
  } catch (err) {
    console.warn('[palyazat.gov.hu] Direct API failed, falling back to __NEXT_DATA__:', err)
  }

  const { tenders: firstPage, totalCount } = await fetchPage(1)
  console.log(`[palyazat.gov.hu] __NEXT_DATA__: ${totalCount} total active grants`)

  const all: PalyazatTender[] = [...firstPage]
  const totalPages = Math.ceil(totalCount / 10)

  for (let page = 2; page <= totalPages; page++) {
    try {
      const { tenders } = await fetchPage(page)
      if (tenders.length === 0) break
      all.push(...tenders)
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
  const f = (form || '').toLowerCase()
  if (f.includes('hitel') || f.includes('pénzügyi eszköz')) return 'LOAN'
  if (f.includes('garancia')) return 'GUARANTEE'
  if (f.includes('visszatérítendő') && !f.includes('nem')) return 'LOAN'
  if (f.includes('vegyes') || f.includes('kombinált')) return 'MIXED'
  return 'GRANT'
}

/**
 * Check if a tender is relevant for businesses or agricultural enterprises (SMB & Agri filter).
 */
function isBusinessRelevant(tender: PalyazatTender): boolean {
  const allCats = [...(tender.beneficiaries || []), ...(tender.categories || [])].map((s) => s.toLowerCase())
  if (allCats.length === 0) return true

  const businessTerms = [
    'vállalkozás',
    'kkv',
    'mikro',
    'kis- és közepes',
    'gazdasági társaság',
    'egyéni vállalkozó',
    'őstermelő',
    'mezőgazdasági',
    'szövetkezet',
    'termelő',
  ]
  return allCats.some((cat) => businessTerms.some((term) => cat.includes(term)))
}

/**
 * Resolve the canonical /programok/... detail page URL via FairApp API,
 * falling back to the /palyazatok/redirect URL if unavailable.
 */
async function resolveDetailUrl(tender: PalyazatTender): Promise<string> {
  if (tender.code) {
    try {
      const resp = await govFetchText(
        `${FAIR_API_BASE}/operational-map/call-for-applications-route?code=${encodeURIComponent(tender.code)}`,
      )
      if (resp.ok) {
        const data = JSON.parse(resp.text) as { route?: string }
        if (data?.route) {
          const segments = data.route.split('/')
          if (segments.length === 4) {
            segments.splice(2, 1)
          }
          return `https://www.palyazat.gov.hu/programok/${segments.join('/')}`
        }
      }
    } catch {
      // Fall back to redirect URL below
    }
  }

  const program = encodeURIComponent(tender.developmentalProgram || '')
  const op = encodeURIComponent(tender.operationalProgram || '')
  const code = encodeURIComponent(tender.code || '')
  return `https://www.palyazat.gov.hu/palyazatok/redirect?program=${program}&op=${op}&code=${code}`
}

/**
 * Extract eligible company sizes from beneficiaries/categories.
 */
function extractSizes(tender: PalyazatTender): string[] {
  const text = [...(tender.beneficiaries || []), ...(tender.categories || [])].join(' ').toLowerCase()
  const sizes: string[] = []
  if (text.includes('mikro') || text.includes('vállalkozás')) sizes.push('MICRO')
  if (text.includes('kis') || text.includes('vállalkozás')) sizes.push('SMALL')
  if (text.includes('közép') || text.includes('közepes') || text.includes('vállalkozás')) sizes.push('MEDIUM')
  return sizes.length > 0 ? sizes : ['MICRO', 'SMALL', 'MEDIUM']
}

/**
 * Extract Hungarian NUTS-2 regions from tender.categories.
 */
function extractRegions(tender: PalyazatTender): string[] {
  const regions: string[] = []
  for (const cat of tender.categories || []) {
    for (const region of HUNGARIAN_REGIONS) {
      if (cat.toLowerCase() === region.toLowerCase() && !regions.includes(region)) {
        regions.push(region)
      }
    }
  }
  return regions
}

/**
 * Extract sector tags from categories.
 */
function extractSectors(tender: PalyazatTender): string[] {
  const sectors: string[] = []
  const cats = (tender.categories || []).map((c) => c.toLowerCase())

  const sectorMap: Record<string, string> = {
    energia: 'Energia',
    digitalizáció: 'Digitalizáció',
    infokommunikáció: 'IT & Digitalizáció',
    információs: 'IT & Digitalizáció',
    közlekedés: 'Közlekedés',
    egészség: 'Egészségügy',
    'k+f': 'Kutatás-fejlesztés',
    innováció: 'Innováció',
    turisztika: 'Turizmus',
    élelmiszeripar: 'Élelmiszeripar',
    mezőgazdaság: 'Mezőgazdaság',
    környezetvédelem: 'Környezetvédelem',
    foglalkoztatás: 'Foglalkoztatás',
    képzés: 'Képzés',
    vállalkozás: 'Vállalkozásfejlesztés',
  }

  for (const cat of cats) {
    for (const [keyword, label] of Object.entries(sectorMap)) {
      if (cat.includes(keyword) && !sectors.includes(label)) {
        sectors.push(label)
      }
    }
  }

  return sectors
}

/**
 * Build rich Hungarian description from structured FairApp tender fields.
 */
function buildDescription(tender: PalyazatTender): string {
  const parts: string[] = []
  if (tender.supportPurpose && tender.supportPurpose.trim().length > 20) {
    parts.push(tender.supportPurpose.trim())
  } else {
    parts.push(tender.name)
  }

  const metaParts: string[] = []
  if (tender.formOfSupport) metaParts.push(`Támogatási forma: ${tender.formOfSupport}`)
  if (tender.developmentalProgram || tender.operationalProgram) {
    metaParts.push(
      `Program: ${[tender.developmentalProgram, tender.operationalProgram].filter(Boolean).join(' / ')}`,
    )
  }
  if (tender.rateOfSupport) metaParts.push(`Max. támogatási intenzitás: ${tender.rateOfSupport}%`)
  if (tender.wayOfAcquiringSupport?.name) {
    metaParts.push(`Eljárásrend: ${tender.wayOfAcquiringSupport.name}`)
  }
  if (tender.sumAvailableSupportAmount && tender.sumAvailableSupportAmount > 0) {
    const mrd = (tender.sumAvailableSupportAmount / 1_000_000_000).toFixed(2)
    metaParts.push(`Keretösszeg: ${mrd} Mrd Ft`)
  }

  if (metaParts.length > 0) {
    parts.push(metaParts.join('. ') + '.')
  }

  return parts.join('\n\n')
}

/**
 * Build initial eligibility summary from FairApp tender fields.
 */
function buildEligibility(tender: PalyazatTender, regions: string[]): string | null {
  const lines: string[] = []
  if (tender.beneficiaries && tender.beneficiaries.length > 0) {
    lines.push(`Pályázók köre: ${tender.beneficiaries.join(', ')}.`)
  }
  if (regions.length > 0) {
    lines.push(`Támogatott régiók: ${regions.join(', ')}.`)
  }
  if (
    tender.conditionsOfSupport &&
    tender.conditionsOfSupport.trim() &&
    !tender.conditionsOfSupport.toLowerCase().includes('részletek a felhívásban')
  ) {
    lines.push(`Feltételek: ${tender.conditionsOfSupport.trim()}`)
  }
  return lines.length > 0 ? lines.join(' ') : null
}

/**
 * Main scraper: fetch all active grants from palyazat.gov.hu via FairApp API / __NEXT_DATA__.
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
        if (!isBusinessRelevant(tender)) continue

        const sourceUrl = await resolveDetailUrl(tender)
        const regions = extractRegions(tender)

        await upsertGrant(source.id, {
          title: tender.name,
          code: tender.code,
          program: tender.operationalProgram || tender.developmentalProgram || undefined,
          status: 'OPEN',
          fundingType: mapFundingType(tender.formOfSupport),
          deadline: tender.endTime?.slice(0, 10) || null,
          openDate: tender.startTime?.slice(0, 10) || null,
          minAmountHuf: tender.minSupportAmount > 1 ? tender.minSupportAmount : null,
          maxAmountHuf: tender.maxSupportAmount > 0 ? tender.maxSupportAmount : null,
          supportIntensityPct: tender.rateOfSupport || null,
          eligibleSizes: extractSizes(tender),
          eligibleSectors: extractSectors(tender),
          eligibleRegions: regions,
          description: buildDescription(tender),
          eligibilityHu: buildEligibility(tender, regions),
          applicationStepsHu: tender.wayOfAcquiringSupport?.name
            ? `Eljárásrend: ${tender.wayOfAcquiringSupport.name}. Beadás a Fair (palyazat.gov.hu) EPTK felületén ügyfélkapus / cégkapus azonosítással.`
            : null,
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
      grantsFound,
      grantsCreated,
      grantsUpdated,
      durationMs,
    })

    console.log(`[palyazat.gov.hu] Done. Found: ${grantsFound}, Business-relevant: ${grantsCreated}. ${durationMs}ms`)
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
    console.error('[palyazat.gov.hu] Fatal error:', error)
    return { success: false, error: errorMessage }
  }
}
