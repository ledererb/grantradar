import { prisma } from '@/lib/db'
import type { GrantStatus, FundingType, CompanySize } from '@prisma/client'

export interface RawGrantData {
  title?: string
  titleEn?: string
  code?: string
  program?: string
  status?: string
  fundingType?: string
  deadline?: string | null
  openDate?: string | null
  minAmountHuf?: number | null
  maxAmountHuf?: number | null
  minAmountEur?: number | null
  maxAmountEur?: number | null
  supportIntensityPct?: number | null
  eligibleSizes?: string[]
  eligibleSectors?: string[]
  eligibleRegions?: string[]
  description?: string
  descriptionEn?: string
  eligibilityHu?: string | null
  applicationStepsHu?: string | null
  documentUrls?: string[]
  sourceUrl: string
  /**
   * Explicit stable identifier for this grant on the source site.
   * Used as the primary deduplication key together with `sourceId`.
   * When omitted, a normalized key is derived from `sourceUrl`.
   */
  externalId?: string
}

/**
 * Normalise a raw status string to our GrantStatus enum
 */
function normaliseStatus(raw?: string): GrantStatus {
  if (!raw) return 'OPEN'
  const lower = raw.toLowerCase()
  if (lower.includes('nyitott') || lower.includes('open') || lower.includes('aktív')) return 'OPEN'
  if (lower.includes('hamarosan') || lower.includes('forthcoming') || lower.includes('tervezett')) return 'FORTHCOMING'
  if (lower.includes('lezárt') || lower.includes('closed') || lower.includes('zárult') || lower.includes('felfüggeszt')) return 'CLOSED'
  if (lower.includes('archív') || lower.includes('archived')) return 'ARCHIVED'
  return 'OPEN'
}

/**
 * Normalise company size strings to our enum values
 */
function normaliseSizes(raw?: string[]): CompanySize[] {
  if (!raw || raw.length === 0) return ['MICRO', 'SMALL', 'MEDIUM']
  const result: CompanySize[] = []
  for (const s of raw) {
    const lower = s.toLowerCase()
    if ((lower.includes('mikro') || lower.includes('micro')) && !result.includes('MICRO')) result.push('MICRO')
    if ((lower.includes('kis') || lower.includes('small')) && !result.includes('SMALL')) result.push('SMALL')
    if ((lower.includes('közép') || lower.includes('medium') || lower.includes('közepes')) && !result.includes('MEDIUM')) result.push('MEDIUM')
  }
  return result.length > 0 ? result : ['MICRO', 'SMALL', 'MEDIUM']
}

/**
 * Normalise a raw funding type string to our FundingType enum
 */
function normaliseFundingType(raw?: string): FundingType {
  if (!raw) return 'GRANT'
  const lower = raw.toLowerCase()
  if (lower.includes('loan') || lower.includes('hitel') || lower.includes('pénzügyi eszköz')) return 'LOAN'
  if (lower.includes('guarantee') || lower.includes('garancia')) return 'GUARANTEE'
  if (lower.includes('mixed') || lower.includes('vegyes') || lower.includes('kombinált')) return 'MIXED'
  return 'GRANT'
}

/**
 * Parse a date string safely
 */
function parseDate(raw?: string | null): Date | null {
  if (!raw) return null
  try {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/**
 * Derive a stable, normalized dedup key from a source URL.
 *
 * Grant portals frequently change tracking params, fragments and trailing
 * slashes — without normalization, the same listing becomes two rows. We
 * strip query strings, fragments and trailing slashes so the URL alone is a
 * reliable identifier when the scraper has no native code/id.
 */
function normalizeUrlKey(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    u.hash = ''
    u.search = ''
    let path = u.pathname.replace(/\/+$/, '')
    if (!path) path = '/'
    return `${u.host}${path}`
  } catch {
    // Not a valid absolute URL — best-effort cleanup of the raw string.
    return rawUrl.split('?')[0].split('#')[0].replace(/\/+$/, '')
  }
}

/**
 * Resolve the deduplication identifier for a grant.
 *
 * Priority:
 *   1. Explicit `externalId` passed by the scraper (most reliable)
 *   2. Official `code` (stable on most Hungarian portals)
 *   3. Normalized sourceUrl (fallback when nothing else is available)
 */
function resolveExternalId(sourceId: string, data: RawGrantData): string {
  if (data.externalId && data.externalId.trim()) return data.externalId.trim()
  if (data.code && data.code.trim()) return data.code.trim()
  return normalizeUrlKey(data.sourceUrl)
}

/**
 * Upsert a grant into the database.
 * Uses sourceId + externalId for deduplication.
 * Preserves deep-scraped fields (`descriptionHu`, `eligibilityHu`, `applicationStepsHu`,
 * `eligibleRegions`) on routine re-scrapes unless the grant is re-opening.
 */
export async function upsertGrant(sourceId: string, data: RawGrantData) {
  const externalId = resolveExternalId(sourceId, data)

  const grantData = {
    titleHu: data.title || null,
    titleEn: data.titleEn || null,
    code: data.code || null,
    program: data.program || null,
    status: normaliseStatus(data.status),
    fundingType: normaliseFundingType(data.fundingType) as FundingType,
    deadline: parseDate(data.deadline),
    openDate: parseDate(data.openDate),
    minAmountHuf: data.minAmountHuf ? BigInt(Math.round(data.minAmountHuf)) : null,
    maxAmountHuf: data.maxAmountHuf ? BigInt(Math.round(data.maxAmountHuf)) : null,
    minAmountEur: data.minAmountEur ?? null,
    maxAmountEur: data.maxAmountEur ?? null,
    supportIntensityPct: data.supportIntensityPct ?? null,
    eligibleSizes: normaliseSizes(data.eligibleSizes),
    eligibleSectors: data.eligibleSectors || [],
    eligibleRegions: data.eligibleRegions || [],
    descriptionHu: data.description || null,
    descriptionEn: data.descriptionEn || null,
    eligibilityHu: data.eligibilityHu || null,
    applicationStepsHu: data.applicationStepsHu || null,
    documentUrls: data.documentUrls || [],
    sourceUrl: data.sourceUrl,
    lastScrapedAt: new Date(),
  }

  // Check existing grant state for re-opening and deep-scrape preservation
  const existing = await prisma.grant.findUnique({
    where: { sourceId_externalId: { sourceId, externalId } },
    select: {
      status: true,
      detailScrapedAt: true,
      descriptionHu: true,
      eligibilityHu: true,
      applicationStepsHu: true,
      eligibleRegions: true,
    },
  })

  const isReopening =
    existing &&
    (existing.status === 'CLOSED' || existing.status === 'ARCHIVED') &&
    (grantData.status === 'OPEN' || grantData.status === 'FORTHCOMING')

  if (isReopening) {
    console.log(`[Upsert] 🔄 Re-opening detected: ${data.code || externalId}`)
  }

  // If the grant was already deep-scraped and is not re-opening, do not overwrite
  // richer deep-scraped text/regions with shorter list-level stubs.
  const preserveDeepScrape = Boolean(existing?.detailScrapedAt && !isReopening)

  const updatePayload = {
    ...grantData,
    descriptionHu:
      preserveDeepScrape &&
      existing?.descriptionHu &&
      existing.descriptionHu.length > (grantData.descriptionHu?.length || 0)
        ? existing.descriptionHu
        : grantData.descriptionHu,
    eligibilityHu:
      preserveDeepScrape && existing?.eligibilityHu
        ? existing.eligibilityHu
        : grantData.eligibilityHu ?? existing?.eligibilityHu ?? null,
    applicationStepsHu:
      preserveDeepScrape && existing?.applicationStepsHu
        ? existing.applicationStepsHu
        : grantData.applicationStepsHu ?? existing?.applicationStepsHu ?? null,
    eligibleRegions:
      grantData.eligibleRegions.length > 0
        ? grantData.eligibleRegions
        : existing?.eligibleRegions ?? [],
    updatedAt: new Date(),
    ...(isReopening
      ? {
          reopenedAt: new Date(),
          detailScrapedAt: null, // Re-scrape detail page for fresh data
        }
      : {}),
  }

  const grant = await prisma.grant.upsert({
    where: {
      sourceId_externalId: {
        sourceId,
        externalId,
      },
    },
    update: updatePayload,
    create: {
      sourceId,
      externalId,
      ...grantData,
    },
  })

  return grant
}

/**
 * Log a crawl run
 */
export async function logCrawlRun(
  sourceId: string,
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED',
  stats: {
    grantsFound: number
    grantsCreated: number
    grantsUpdated: number
    durationMs: number
    errorMessage?: string
  },
) {
  await prisma.crawlLog.create({
    data: {
      sourceId,
      status,
      ...stats,
      finishedAt: new Date(),
    },
  })

  await prisma.source.update({
    where: { id: sourceId },
    data: {
      lastRunAt: new Date(),
      lastStatus: status,
      errorMessage: stats.errorMessage || null,
    },
  })
}
