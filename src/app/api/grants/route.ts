import { NextRequest, NextResponse } from 'next/server'
import { prisma, pgPool } from '@/lib/db'
import { generateEmbedding } from '@/lib/openai'
import { searchRateLimit, applyRateLimit } from '@/lib/rate-limit'
import { getUserPlan, planLimits } from '@/lib/plan-limits'
import { createClient } from '@/lib/supabase/server'
import { searchGrantsSchema } from '@/lib/validations'
import type { GrantStatus, FundingType, CompanySize } from '@prisma/client'

/**
 * GET /api/grants — Public grant listing with filters + search
 */
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(searchRateLimit, request)
  if (limited) return limited

  const { searchParams } = new URL(request.url)

  // Validate the search query text + pagination. The browse case (no `q`/`semantic`)
  // only validates pagination.
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

  // Clamp pagination (1..50) for the browse case and as a safety net.
  const parsedPage = Number.parseInt(searchParams.get('page') || '1', 10)
  const parsedLimit = Number.parseInt(searchParams.get('limit') || '20', 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20, 50)
  const skip = (page - 1) * limit

  // Filters
  const status = searchParams.get('status') as GrantStatus | null
  const fundingType = searchParams.get('fundingType') as FundingType | null
  const program = searchParams.get('program')
  const size = searchParams.get('size') as CompanySize | null
  const country = searchParams.get('country')
  const search = searchParams.get('q')
  const semanticSearch = searchParams.get('semantic')
  const sortBy = searchParams.get('sort') || 'deadline'
  const sortOrder = searchParams.get('order') || 'asc'

  // Semantic search — use vector similarity via raw pg
  if (semanticSearch) {
    // Gate semantic search by plan: only PRO/AGENCY can use it.
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    let allowed = false
    if (authUser) {
      const dbUser = await prisma.user.findUnique({
        where: { supabaseId: authUser.id },
        select: { id: true },
      })
      if (dbUser) {
        const plan = await getUserPlan(dbUser.id)
        allowed = planLimits(plan).semanticSearch
      }
    }

    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Semantic search requires a PRO plan.',
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
          json_build_object('name', s.name, 'country', s.country) as source,
          1 - (g.embedding <=> $1::vector) as similarity
        FROM "Grant" g
        JOIN "Source" s ON g."sourceId" = s.id
        WHERE g.embedding IS NOT NULL
          AND g.status IN ('OPEN', 'FORTHCOMING')
        ORDER BY g.embedding <=> $1::vector
        LIMIT $2 OFFSET $3`,
        [vectorStr, limit, skip]
      )

      return NextResponse.json({
        grants: result.rows,
        total: result.rows.length,
        page,
        limit,
        semantic: true,
      })
    } catch (error) {
      console.error('Semantic search error:', error)
      // Fall back to text search below
    }
  }

  // Build where clause for regular search
  const where: Record<string, unknown> = {}

  if (status) where.status = status
  if (fundingType) where.fundingType = fundingType
  if (program) where.program = { contains: program, mode: 'insensitive' }
  if (size) where.eligibleSizes = { has: size }
  if (country) {
    where.source = { country }
  }

  // Text search
  if (search) {
    where.OR = [
      { titleHu: { contains: search, mode: 'insensitive' } },
      { titleEn: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { program: { contains: search, mode: 'insensitive' } },
      { descriptionHu: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Regular database query
  const orderBy: Record<string, string> = {}
  if (sortBy === 'deadline') orderBy.deadline = sortOrder
  else if (sortBy === 'amount') orderBy.maxAmountHuf = sortOrder
  else if (sortBy === 'date') orderBy.firstSeenAt = sortOrder
  else orderBy.deadline = 'asc'

  const [grants, total] = await Promise.all([
    prisma.grant.findMany({
      where,
      include: {
        source: {
          select: { name: true, country: true },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.grant.count({ where }),
  ])

  // Serialize BigInt fields to strings for JSON compatibility
  const serializedGrants = grants.map(g => ({
    ...g,
    minAmountHuf: g.minAmountHuf?.toString() ?? null,
    maxAmountHuf: g.maxAmountHuf?.toString() ?? null,
  }))

  return NextResponse.json({
    grants: serializedGrants,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
