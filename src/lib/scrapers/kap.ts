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

export interface KapDetailInfo {
  goal: string | null
  beneficiaries: string | null
  conditions: string | null
  intensityText: string | null
  intensityPct: number | null
  procedureType: string | null
  budgetText: string | null
  nextPhaseText: string | null
  furtherPhasesText: string | null
  startDate: string | null
  endDate: string | null
}

/**
 * Parse a single grant card HTML snippet from the KAP REST API.
 */
export function parseGrantCard(html: string): ParsedKapCard {
  const titleMatch = html.match(/pbtitle">\s*(.*?)\s*</)
  const rawTitle = titleMatch?.[1]?.trim() || ''

  const codeMatch = rawTitle.match(/(KAP-[A-Za-z0-9_-]+)/)
  const code = codeMatch?.[1] || null

  const title = code
    ? rawTitle.replace(/\s*-\s*KAP-[A-Za-z0-9_-]+$/, '').replace(code, '').trim()
    : rawTitle

  const statusMatch = html.match(/(Aktív|Lezárult|Felfüggesztve)/)
  const status = (statusMatch?.[1] as 'Aktív' | 'Lezárult' | 'Felfüggesztve') || null

  const urlMatch =
    html.match(/href="(\/tamogatas\/[^"]+)"/) ||
    html.match(/window\.open\(['"](\/tamogatas\/[^'"]+)['"]/)
  const detailUrl = urlMatch?.[1] || null

  const minMatch = html.match(/minimum összege<\/label>([^<]+)/)
  const minAmount = minMatch?.[1]?.trim() || null

  const maxMatch = html.match(/maximum összege<\/label>([^<]+)/)
  const maxAmount = maxMatch?.[1]?.trim() || null

  const formMatch = html.match(/formája<\/label>([^<]+)/)
  const supportForm = formMatch?.[1]?.trim() || null

  const dateMatch = html.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:→|<img[^>]*>)\s*(\d{4}-\d{2}-\d{2})/i,
  )
  const startDate = dateMatch?.[1] || null
  const endDate = dateMatch?.[2] || null

  return { code, title, status, detailUrl, minAmount, maxAmount, supportForm, startDate, endDate }
}

/**
 * Parse amount string like "1 500 000 Ft", "Legfeljebb 100 millió Ft",
 * "50.000 eurónak megfelelő forintösszeg", or "nincs megadva" → HUF number or null.
 */
export function parseKapAmountHuf(str: string | null): number | null {
  if (!str) return null
  const lower = str.toLowerCase().trim()
  if (lower === 'nincs megadva' || lower === '-' || lower === '') return null
  if (lower.includes('%') && !lower.includes('ft') && !lower.includes('forint') && !lower.includes('eur')) {
    return null
  }
  if (lower.includes('/hektár') || lower.includes('/ha') || lower.includes('/állat')) {
    return null
  }

  // Handle "millió" / "milliárd" multipliers (e.g. "Legfeljebb 100 millió Ft", "1,5 milliárd Ft")
  const normDecimal = lower.replace(/,/g, '.')
  if (lower.includes('milliárd') || lower.includes('mrd')) {
    const m = normDecimal.match(/(\d+(?:\.\d+)?)/)
    if (m) {
      const val = parseFloat(m[1])
      if (!isNaN(val) && val > 0) {
        const huf = Math.round(val * 1_000_000_000)
        return lower.includes('eur') || lower.includes('€') ? huf * 400 : huf
      }
    }
  }

  if (lower.includes('millió')) {
    const m = normDecimal.match(/(\d+(?:\.\d+)?)/)
    if (m) {
      const val = parseFloat(m[1])
      if (!isNaN(val) && val > 0) {
        const huf = Math.round(val * 1_000_000)
        return lower.includes('eur') || lower.includes('€') ? huf * 400 : huf
      }
    }
  }

  const cleaned = str.replace(/[^0-9]/g, '')
  const num = parseInt(cleaned, 10)
  if (isNaN(num) || num === 0) return null

  const result = lower.includes('eur') || lower.includes('€') ? num * 400 : num
  return result >= 100_000 ? result : null
}

/**
 * Extract structured fields from a KAP detail page (`https://kap.gov.hu/tamogatas/...`).
 */
export function parseKapDetailHtml(html: string): KapDetailInfo {
  function extractRowValue(label: string): string | null {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(
      `<div class="col-md-3">\\s*${escaped}\\s*<\\/div>\\s*<div class="col-md-9">([\\s\\S]*?)<\\/div>\\s*<\\/div>`,
      'i',
    )
    const m = html.match(re)
    if (!m) {
      // Fallback for nested inner div inside col-md-9
      const reNested = new RegExp(
        `<div class="col-md-3">\\s*${escaped}\\s*<\\/div>\\s*<div class="col-md-9">([\\s\\S]*?)<\\/div>\\s*<\\/div>\\s*<\\/div>`,
        'i',
      )
      const m2 = html.match(reNested)
      if (!m2) return null
      const cleaned = m2[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&ndash;/gi, '–')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return cleaned && cleaned !== '-' ? cleaned : null
    }
    const cleaned = m[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&ndash;/gi, '–')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return cleaned && cleaned !== '-' ? cleaned : null
  }

  const goal = extractRowValue('Támogatás célja')
  const beneficiaries = extractRowValue('Kedvezményezettek köre')
  const conditions = extractRowValue('Támogatási feltételek')
  const intensityText = extractRowValue('Támogatás mértéke')
  const procedureType = extractRowValue('Eljárás típusa')
  const budgetText = extractRowValue('Forrás összege')
  const nextPhaseText = extractRowValue('Kérelem benyújtás következő szakasza')
  const furtherPhasesText = extractRowValue('További benyújtási szakasz')

  let intensityPct: number | null = null
  if (intensityText) {
    const pctMatch = intensityText.match(/(\d{1,3})\s*%/)
    if (pctMatch) {
      const n = parseInt(pctMatch[1], 10)
      if (n > 0 && n <= 100) intensityPct = n
    }
  }

  // Extract <time datetime="YYYY-MM-DD..."> from Kérelem benyújtás következő szakasza & További benyújtási szakasz
  const timeMatches = [...html.matchAll(/<time\s+datetime="(\d{4}-\d{2}-\d{2})[^"]*"/gi)].map(
    (m) => m[1],
  )
  const todayIso = new Date().toISOString().slice(0, 10)
  const futureDates = timeMatches.filter((d) => d >= todayIso)
  const startDate = timeMatches[0] || null
  // Only set a closing deadline on an active KAP call if there is a future phase end date;
  // otherwise keep null so multi-phase active calls aren't auto-archived by past phase dates.
  const endDate = futureDates.length > 0 ? futureDates[futureDates.length - 1] : null

  return {
    goal,
    beneficiaries,
    conditions,
    intensityText,
    intensityPct,
    procedureType,
    budgetText,
    nextPhaseText,
    furtherPhasesText,
    startDate,
    endDate,
  }
}

async function fetchKapDetail(detailUrl: string): Promise<KapDetailInfo | null> {
  try {
    const resp = await fetch(`https://kap.gov.hu${detailUrl}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrantRadar/1.0)' },
    })
    if (!resp.ok) return null
    const html = await resp.text()
    return parseKapDetailHtml(html)
  } catch {
    return null
  }
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
 * Main scraper: fetch all KAP grants via REST API + detail page HTML and upsert.
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

        const detail = grant.detailUrl ? await fetchKapDetail(grant.detailUrl) : null

        const startDate = grant.startDate || detail?.startDate || undefined
        const endDate = grant.endDate || detail?.endDate || undefined

        const descParts: string[] = []
        if (detail?.goal) {
          descParts.push(detail.goal)
        } else {
          descParts.push(grant.title)
        }
        const metaParts = [
          `Támogatási forma: ${grant.supportForm || 'VNT'}`,
          'Program: KAP Stratégiai Terv',
          detail?.budgetText ? `Keretösszeg: ${detail.budgetText}` : null,
          detail?.intensityText ? `Támogatás mértéke: ${detail.intensityText}` : null,
        ].filter(Boolean)
        descParts.push(metaParts.join('. ') + '.')

        const eligParts = [
          detail?.beneficiaries ? `Kedvezményezettek köre: ${detail.beneficiaries}` : null,
          detail?.conditions ? `Támogatási feltételek: ${detail.conditions}` : null,
        ].filter(Boolean)

        const stepParts = [
          detail?.procedureType ? `Eljárás típusa: ${detail.procedureType}.` : null,
          detail?.nextPhaseText ? `Következő benyújtási szakasz: ${detail.nextPhaseText}.` : null,
          detail?.furtherPhasesText ? `További szakaszok: ${detail.furtherPhasesText}.` : null,
          'Beadás a Magyar Államkincstár (MÁK) elektronikus felületén KNYR regisztrációval.',
        ].filter(Boolean)

        await upsertGrant(source.id, {
          title: grant.title || grant.code || 'N/A',
          code: grant.code || grant.title?.slice(0, 40),
          program: 'Közös Agrárpolitika (KAP)',
          status,
          fundingType: mapFundingType(grant.supportForm),
          deadline: endDate,
          openDate: startDate,
          minAmountHuf: parseKapAmountHuf(grant.minAmount),
          maxAmountHuf: parseKapAmountHuf(grant.maxAmount),
          supportIntensityPct: detail?.intensityPct ?? null,
          eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
          eligibleSectors: ['Mezőgazdaság', 'Agrár', 'Vidékfejlesztés', 'Élelmiszeripar'],
          eligibleRegions: ['Országos (KAP célterület)'],
          description: descParts.join('\n\n'),
          eligibilityHu: eligParts.length > 0 ? eligParts.join(' ') : null,
          applicationStepsHu: stepParts.join(' '),
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
