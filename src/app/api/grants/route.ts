import { NextRequest, NextResponse } from 'next/server'
import { prisma, pgPool } from '@/lib/db'
import { generateEmbedding } from '@/lib/openai'
import { searchRateLimit, generalRateLimit, applyRateLimit } from '@/lib/rate-limit'
import { getUserPlan, planLimits } from '@/lib/plan-limits'
import { createClient } from '@/lib/supabase/server'
import { searchGrantsSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/errors'
import { getEffectiveStatus, isTechnicalGrantCall, normalizeGrantCodeQuery } from '@/lib/utils'
import {
  evaluateGrantEligibility,
  parseUserProfile,
  type CompanyPreScreenProfile,
} from '@/lib/grant-handbook'
import type { Prisma } from '@prisma/client'

type TargetGroup = 'KKV' | 'AGRI' | 'STARTUP' | 'MUNICIPAL'

function buildSearchWhere(rawQuery: string): Prisma.GrantWhereInput {
  const trimmed = rawQuery.trim()
  const lower = trimmed.toLowerCase()
  const variants = normalizeGrantCodeQuery(trimmed)

  // Avoid false positives when searching for "önkormányzat" (never match KAP Vidékfejlesztés or SMB-only MFP Kisboltok)
  if (lower.includes('önkormányzat') || lower.includes('település')) {
    return {
      OR: [
        { titleHu: { contains: trimmed, mode: 'insensitive' } },
        { program: { contains: trimmed, mode: 'insensitive' } },
        { eligibilityHu: { contains: `Pályázók köre: ${trimmed}`, mode: 'insensitive' } },
        { eligibilityHu: { contains: 'helyi önkormányzat', mode: 'insensitive' } },
        { aiSectors: { hasSome: ['Önkormányzat', 'Önkormányzatok', 'Önkormányzati szolgáltatások', 'Önkormányzati fejlesztések', 'Közszféra'] } },
      ],
    }
  }

  const orConditions: Prisma.GrantWhereInput[] = []
  for (const variant of variants) {
    orConditions.push(
      { code: { contains: variant, mode: 'insensitive' } },
      { titleHu: { contains: variant, mode: 'insensitive' } },
      { titleEn: { contains: variant, mode: 'insensitive' } },
      { program: { contains: variant, mode: 'insensitive' } },
    )
  }
  orConditions.push({ descriptionHu: { contains: trimmed, mode: 'insensitive' } })
  orConditions.push({ aiSummaryHu: { contains: trimmed, mode: 'insensitive' } })

  return { OR: orConditions }
}

function buildProgramWhere(program: string): Prisma.GrantWhereInput {
  const p = program.trim()
  const upper = p.toUpperCase()
  if (upper === 'SZÉCHENYI' || upper === 'SZECHENYI') {
    return {
      OR: [
        { program: { contains: 'Széchenyi', mode: 'insensitive' } },
        { titleHu: { contains: 'Széchenyi', mode: 'insensitive' } },
        { code: { contains: 'MFB', mode: 'insensitive' } },
        { source: { slug: { in: ['kavosz', 'mfb'] } } },
      ],
    }
  }
  return {
    OR: [
      { program: { contains: p, mode: 'insensitive' } },
      { code: { contains: p, mode: 'insensitive' } },
      { code: { contains: upper.replace(/\s+/g, '_'), mode: 'insensitive' } },
      { titleHu: { contains: p, mode: 'insensitive' } },
      { source: { slug: { contains: p.toLowerCase() } } },
    ],
  }
}

function buildStatusWhere(statusParam: string, now: Date): Prisma.GrantWhereInput {
  const status = statusParam.toUpperCase()
  if (status === 'ALL') return {}
  if (status === 'OPEN') {
    return {
      status: 'OPEN',
      AND: [
        { OR: [{ deadline: null }, { deadline: { gte: now } }] },
        { OR: [{ openDate: null }, { openDate: { lte: now } }] },
      ],
    }
  }
  if (status === 'FORTHCOMING') {
    return {
      AND: [
        { OR: [{ deadline: null }, { deadline: { gte: now } }] },
        {
          OR: [
            { status: 'FORTHCOMING' },
            { status: 'OPEN', openDate: { gt: now } },
          ],
        },
      ],
    }
  }
  if (status === 'CLOSED' || status === 'ARCHIVED') {
    return {
      OR: [
        { status: { in: ['CLOSED', 'ARCHIVED'] } },
        { deadline: { lt: now } },
      ],
    }
  }
  // Default: ACTIVE (OPEN + FORTHCOMING, excluding expired deadlines)
  return {
    status: { in: ['OPEN', 'FORTHCOMING'] },
    OR: [{ deadline: null }, { deadline: { gte: now } }],
  }
}

function matchesTargetGroup(
  grant: {
    titleHu: string | null
    code: string | null
    program: string | null
    eligibilityHu: string | null
    eligibleSectors: string[]
    aiSectors: string[]
    source: { slug: string }
  },
  target: TargetGroup,
): boolean {
  const sectors = [...(grant.eligibleSectors || []), ...(grant.aiSectors || [])].join(' ').toLowerCase()
  const titleAndProg = `${grant.titleHu || ''} ${grant.code || ''} ${grant.program || ''}`.toLowerCase()
  const elig = (grant.eligibilityHu || '').toLowerCase()

  if (target === 'MUNICIPAL') {
    return (
      sectors.includes('önkormányzat') ||
      sectors.includes('közszféra') ||
      titleAndProg.includes('önkormányzat') ||
      elig.includes('önkormányzat')
    )
  }

  if (target === 'AGRI') {
    return (
      titleAndProg.includes('kap') ||
      grant.source.slug === 'kap' ||
      sectors.includes('mezőgazdaság') ||
      sectors.includes('élelmiszeripar') ||
      titleAndProg.includes('agrár') ||
      titleAndProg.includes('mezőgazdaság')
    )
  }

  if (target === 'STARTUP') {
    return (
      titleAndProg.includes('nkfi') ||
      titleAndProg.includes('k+f') ||
      titleAndProg.includes('innováció') ||
      titleAndProg.includes('startup') ||
      grant.source.slug === 'nkfih' ||
      sectors.includes('kutatás') ||
      sectors.includes('innováció')
    )
  }

  // KKV
  const municipalOnly =
    (sectors.includes('önkormányzat') || titleAndProg.includes('önkormányzati')) &&
    !elig.includes('vállalkozás') &&
    !elig.includes('kkv') &&
    !titleAndProg.includes('kkv') &&
    !titleAndProg.includes('vállalkozás')
  return !municipalOnly
}

function scoreGrantRelevance(
  grant: {
    titleHu: string | null
    code: string | null
    program: string | null
    status: string
    fundingType: string
    deadline: Date | null
    openDate: Date | null
    eligibleSectors: string[]
    aiSectors: string[]
    source: { country: string; slug: string }
  },
  profile: CompanyPreScreenProfile | null,
  evaluation: ReturnType<typeof evaluateGrantEligibility> | null,
  now: Date,
): number {
  let score = 0
  const eff = getEffectiveStatus(grant, now)
  if (eff === 'OPEN') score += 100
  else if (eff === 'FORTHCOMING') score += 60
  else score -= 100

  const haystack = `${grant.code || ''} ${grant.program || ''} ${grant.titleHu || ''}`.toLowerCase()
  if (/(ginop|dimop|kap|nkfi|széchenyi|mfb|kavosz)/i.test(haystack)) {
    score += 40
  }
  if (grant.source.country === 'HU') score += 25
  if (grant.fundingType === 'GRANT' || grant.fundingType === 'MIXED') score += 15

  if (grant.deadline) {
    const daysLeft = (grant.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (daysLeft >= 0 && daysLeft <= 90) score += 18
    else if (daysLeft > 90 && daysLeft <= 365) score += 8
  }

  if (isTechnicalGrantCall(grant.titleHu, grant.code)) {
    score -= 120
  }

  if (profile && evaluation && evaluation.profileConfigured) {
    if (evaluation.failCount === 0 && evaluation.warnCount === 0) score += 35
    else if (evaluation.failCount === 0) score += 15
    else score -= 60

    if (profile.sectorPrefs.length > 0) {
      const grantSectors = [...(grant.eligibleSectors || []), ...(grant.aiSectors || [])]
        .join(' ')
        .toLowerCase()
      const matched = profile.sectorPrefs.some((s) =>
        grantSectors.includes(s.toLowerCase().split(' ')[0]),
      )
      if (matched) score += 22
    }
  }

  return score
}

/**
 * GET /api/grants — Grant listing with filters, relevance sorting, and profile matching
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isSemantic = Boolean(searchParams.get('semantic'))
    const limited = await applyRateLimit(
      isSemantic ? searchRateLimit : generalRateLimit,
      request,
    )
    if (limited) return limited

    const queryText = searchParams.get('semantic') || searchParams.get('q') || ''
    if (queryText) {
      const searchValidation = searchGrantsSchema.safeParse({
        query: queryText,
        page: searchParams.get('page') || undefined,
        pageSize: searchParams.get('limit') || undefined,
      })
      if (!searchValidation.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: searchValidation.error.flatten() },
          { status: 400 },
        )
      }
    }

    const parsedPage = Number.parseInt(searchParams.get('page') || '1', 10)
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '15', 10)
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
    const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 15, 50)
    const skip = (page - 1) * limit

    const statusParam = searchParams.get('status') || 'ACTIVE'
    const fundingType = searchParams.get('fundingType')
    const program = searchParams.get('program')
    const size = searchParams.get('size')
    const countryParam = searchParams.get('country')
    const country = countryParam === 'ALL' ? '' : countryParam ?? ''
    const targetParam = (searchParams.get('target') || '').toUpperCase() as TargetGroup | ''
    const forMe = searchParams.get('forMe') === '1' || searchParams.get('forMe') === 'true'
    const search = searchParams.get('q')
    const semanticSearch = searchParams.get('semantic')
    const sortBy = searchParams.get('sort') || 'relevance'
    const sortOrder = searchParams.get('order') === 'desc' ? 'desc' : 'asc'

    const now = new Date()

    // Load authenticated user + profile (for semantic gating + personalized matching even on FREE tier)
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    let dbUser: { id: string; profile: Parameters<typeof parseUserProfile>[0] } | null = null
    if (authUser) {
      dbUser = await prisma.user.findUnique({
        where: { supabaseId: authUser.id },
        select: {
          id: true,
          profile: true,
        },
      })
    }

    const companyProfile = dbUser?.profile ? parseUserProfile(dbUser.profile) : null

    // Semantic search — PRO / AGENCY gated
    if (semanticSearch) {
      let allowed = false
      if (dbUser) {
        const plan = await getUserPlan(dbUser.id)
        allowed = planLimits(plan).semanticSearch
      }

      if (!allowed) {
        return NextResponse.json(
          {
            error: 'A szabadszavas AI okoskereső PRO csomaggal érhető el.',
            code: 'PLAN_REQUIRED',
          },
          { status: 403 },
        )
      }

      try {
        const embedding = await generateEmbedding(semanticSearch)
        const vectorStr = `[${embedding.join(',')}]`

        const result = await pgPool.query(
          `SELECT
            g.id, g."titleHu", g."titleEn", g.code, g.program,
            g.status, g."fundingType", g.deadline, g."openDate",
            g."minAmountHuf"::text as "minAmountHuf",
            g."maxAmountHuf"::text as "maxAmountHuf",
            g."minAmountEur", g."maxAmountEur",
            g."supportIntensityPct", g."eligibleSizes", g."eligibleSectors",
            g."descriptionHu", g."aiSummaryHu", g."aiKeyPoints",
            g."aiDifficultyScore", g."aiSectors", g."sourceUrl",
            json_build_object('name', s.name, 'country', s.country, 'slug', s.slug) as source,
            1 - (g.embedding <=> $1::vector) as similarity
          FROM "Grant" g
          JOIN "Source" s ON g."sourceId" = s.id
          WHERE g.embedding IS NOT NULL
            AND g.status IN ('OPEN', 'FORTHCOMING')
            AND (g.deadline IS NULL OR g.deadline >= NOW())
          ORDER BY g.embedding <=> $1::vector
          LIMIT $2 OFFSET $3`,
          [vectorStr, limit, skip],
        )

        const enriched = result.rows.map((row) => ({
          ...row,
          effectiveStatus: getEffectiveStatus(row, now),
          eligibilityVerdict: companyProfile
            ? (() => {
                const ev = evaluateGrantEligibility(row, companyProfile)
                return { label: ev.verdictLabel, tone: ev.verdictTone, failCount: ev.failCount }
              })()
            : null,
        }))

        return NextResponse.json({
          grants: enriched,
          total: enriched.length,
          page,
          limit,
          totalPages: 1,
          semantic: true,
        })
      } catch (error) {
        console.error('Semantic search error:', error)
      }
    }

    // Build structured Prisma where clause
    const andClauses: Prisma.GrantWhereInput[] = []
    const statusWhere = buildStatusWhere(statusParam, now)
    if (Object.keys(statusWhere).length > 0) andClauses.push(statusWhere)

    if (fundingType) andClauses.push({ fundingType: fundingType as Prisma.GrantWhereInput['fundingType'] })
    if (program) andClauses.push(buildProgramWhere(program))
    if (size) andClauses.push({ eligibleSizes: { has: size as 'MICRO' | 'SMALL' | 'MEDIUM' } })
    if (country) andClauses.push({ source: { country: country as 'HU' | 'EU' | 'INT' } })
    if (search) andClauses.push(buildSearchWhere(search))

    const where: Prisma.GrantWhereInput = andClauses.length > 0 ? { AND: andClauses } : {}

    const allCandidates = await prisma.grant.findMany({
      where,
      include: {
        source: {
          select: { name: true, country: true, slug: true },
        },
      },
      orderBy:
        sortBy === 'date'
          ? { firstSeenAt: 'desc' }
          : sortBy === 'amount'
            ? { maxAmountHuf: 'desc' }
            : { deadline: 'asc' },
    })

    // Filter out internal technical calls unless user explicitly searches for a code
    const isCodeSearch = Boolean(search && /[-_/]|\d/.test(search))
    let filtered = allCandidates.filter((g) => {
      if (!isCodeSearch && isTechnicalGrantCall(g.titleHu, g.code)) return false
      if (targetParam && !matchesTargetGroup(g, targetParam)) return false
      return true
    })

    const evaluatedMap = new Map<
      string,
      ReturnType<typeof evaluateGrantEligibility>
    >()

    if (companyProfile || forMe) {
      const profileToUse = companyProfile || parseUserProfile(null)
      for (const g of filtered) {
        evaluatedMap.set(g.id, evaluateGrantEligibility(g, profileToUse))
      }
    }

    if (forMe && companyProfile) {
      filtered = filtered.filter((g) => {
        const eff = getEffectiveStatus(g, now)
        if (eff === 'CLOSED' && statusParam !== 'CLOSED' && statusParam !== 'ALL') return false
        const ev = evaluatedMap.get(g.id)
        if (!ev || ev.failCount > 0) return false
        if (companyProfile.sectorPrefs.length > 0) {
          const grantSectors = [...(g.eligibleSectors || []), ...(g.aiSectors || [])]
            .join(' ')
            .toLowerCase()
          const sectorMatch = companyProfile.sectorPrefs.some((s) =>
            grantSectors.includes(s.toLowerCase().split(' ')[0]),
          )
          if (!sectorMatch && grantSectors.length > 0) return false
        }
        return true
      })
    }

    // Deterministic sorting
    if (sortBy === 'relevance') {
      filtered.sort((a, b) => {
        const scoreB = scoreGrantRelevance(b, companyProfile, evaluatedMap.get(b.id) || null, now)
        const scoreA = scoreGrantRelevance(a, companyProfile, evaluatedMap.get(a.id) || null, now)
        if (scoreB !== scoreA) return scoreB - scoreA
        const dA = a.deadline ? a.deadline.getTime() : Number.MAX_SAFE_INTEGER
        const dB = b.deadline ? b.deadline.getTime() : Number.MAX_SAFE_INTEGER
        return dA - dB
      })
    } else if (sortBy === 'deadline') {
      const isClosedView = statusParam.toUpperCase() === 'CLOSED'
      filtered.sort((a, b) => {
        const dA = a.deadline ? a.deadline.getTime() : (isClosedView ? 0 : Number.MAX_SAFE_INTEGER)
        const dB = b.deadline ? b.deadline.getTime() : (isClosedView ? 0 : Number.MAX_SAFE_INTEGER)
        return isClosedView || sortOrder === 'desc' ? dB - dA : dA - dB
      })
    } else if (sortBy === 'amount') {
      filtered.sort((a, b) => {
        const aAmt = Number(a.maxAmountHuf ?? a.maxAmountEur ?? 0)
        const bAmt = Number(b.maxAmountHuf ?? b.maxAmountEur ?? 0)
        return bAmt - aAmt
      })
    } else if (sortBy === 'date') {
      filtered.sort((a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime())
    }

    const total = filtered.length
    const paged = filtered.slice(skip, skip + limit)

    // If user searched in an active view and got 0 matches, check if closed grants match
    let closedMatchCount = 0
    if (total === 0 && search && statusParam !== 'CLOSED' && statusParam !== 'ALL') {
      closedMatchCount = await prisma.grant.count({
        where: {
          AND: [
            buildStatusWhere('CLOSED', now),
            buildSearchWhere(search),
          ],
        },
      })
    }

    const serializedGrants = paged.map((g) => {
      const ev = evaluatedMap.get(g.id)
      const effectiveStatus = getEffectiveStatus(g, now)
      return {
        ...g,
        status: effectiveStatus,
        effectiveStatus,
        minAmountHuf: g.minAmountHuf?.toString() ?? null,
        maxAmountHuf: g.maxAmountHuf?.toString() ?? null,
        eligibilityVerdict:
          ev && ev.profileConfigured
            ? { label: ev.verdictLabel, tone: ev.verdictTone, failCount: ev.failCount }
            : null,
      }
    })

    return NextResponse.json({
      grants: serializedGrants,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      closedMatchCount,
      profileConfigured: Boolean(
        companyProfile &&
          (companyProfile.companySizePref.length > 0 ||
            companyProfile.legalForm ||
            companyProfile.closedFiscalYears !== null ||
            companyProfile.annualRevenueM !== null ||
            companyProfile.regions.length > 0 ||
            companyProfile.sectorPrefs.length > 0),
      ),
    })
  } catch (error) {
    return handleApiError(error, 'Grants GET')
  }
}
