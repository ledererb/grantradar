import { prisma } from '@/lib/db'
import { scrapeGrantPage, crawlGrantSite } from '@/lib/firecrawl'
import type { GrantStatus, FundingType, CompanySize } from '@prisma/client'

interface RawGrantData {
  title?: string
  code?: string
  program?: string
  status?: string
  fundingType?: string
  deadline?: string | null
  openDate?: string | null
  minAmountHuf?: number | null
  maxAmountHuf?: number | null
  supportIntensityPct?: number | null
  eligibleSizes?: string[]
  eligibleSectors?: string[]
  description?: string
  documentUrls?: string[]
  sourceUrl: string
}

/**
 * Normalise a raw status string to our GrantStatus enum
 */
function normaliseStatus(raw?: string): GrantStatus {
  if (!raw) return 'OPEN'
  const lower = raw.toLowerCase()
  if (lower.includes('nyitott') || lower.includes('open') || lower.includes('aktív')) return 'OPEN'
  if (lower.includes('hamarosan') || lower.includes('forthcoming') || lower.includes('tervezett')) return 'FORTHCOMING'
  if (lower.includes('lezárt') || lower.includes('closed') || lower.includes('zárult')) return 'CLOSED'
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
    if (lower.includes('mikro') || lower.includes('micro')) result.push('MICRO')
    if (lower.includes('kis') || lower.includes('small')) result.push('SMALL')
    if (lower.includes('közép') || lower.includes('medium') || lower.includes('közepes')) result.push('MEDIUM')
  }
  return result.length > 0 ? result : ['MICRO', 'SMALL', 'MEDIUM']
}

/**
 * Normalise a raw funding type string to our FundingType enum
 */
function normaliseFundingType(raw?: string): FundingType {
  if (!raw) return 'GRANT'
  const lower = raw.toLowerCase()
  if (lower.includes('loan') || lower.includes('hitel')) return 'LOAN'
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
 * Upsert a grant into the database. 
 * Uses sourceId + externalId for deduplication.
 */
export async function upsertGrant(sourceId: string, data: RawGrantData) {
  const externalId = data.code || data.sourceUrl

  const grantData = {
    titleHu: data.title || null,
    code: data.code || null,
    program: data.program || null,
    status: normaliseStatus(data.status),
    fundingType: (normaliseFundingType(data.fundingType)) as FundingType,
    deadline: parseDate(data.deadline),
    openDate: parseDate(data.openDate),
    minAmountHuf: data.minAmountHuf ? BigInt(data.minAmountHuf) : null,
    maxAmountHuf: data.maxAmountHuf ? BigInt(data.maxAmountHuf) : null,
    supportIntensityPct: data.supportIntensityPct || null,
    eligibleSizes: normaliseSizes(data.eligibleSizes),
    eligibleSectors: data.eligibleSectors || [],
    eligibleRegions: [],
    descriptionHu: data.description || null,
    documentUrls: data.documentUrls || [],
    sourceUrl: data.sourceUrl,
    lastScrapedAt: new Date(),
  }

  // Check for re-opening: existing CLOSED grant becoming OPEN again
  const existing = await prisma.grant.findUnique({
    where: { sourceId_externalId: { sourceId, externalId } },
    select: { status: true },
  })

  const isReopening = existing
    && (existing.status === 'CLOSED' || existing.status === 'ARCHIVED')
    && (grantData.status === 'OPEN' || grantData.status === 'FORTHCOMING')

  if (isReopening) {
    console.log(`[Upsert] 🔄 Re-opening detected: ${data.code || externalId}`)
  }

  const grant = await prisma.grant.upsert({
    where: {
      sourceId_externalId: {
        sourceId,
        externalId,
      },
    },
    update: {
      ...grantData,
      updatedAt: new Date(),
      ...(isReopening ? {
        reopenedAt: new Date(),
        detailScrapedAt: null,  // Re-scrape detail page for fresh data
      } : {}),
    },
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
  }
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
