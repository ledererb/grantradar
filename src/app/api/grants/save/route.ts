import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { generalRateLimit, applyRateLimit } from '@/lib/rate-limit'
import { getUserPlan, planLimits } from '@/lib/plan-limits'
import { saveGrantSchema, updateSavedGrantChecklistSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/errors'
import { parseSavedGrantState, serializeSavedGrantState } from '@/lib/grant-handbook'

async function getOrCreateDbUser(authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  return prisma.user.upsert({
    where: { supabaseId: authUser.id },
    update: {},
    create: {
      supabaseId: authUser.id,
      email: authUser.email || `${authUser.id}@grantradar.local`,
      name: typeof authUser.user_metadata?.name === 'string' ? authUser.user_metadata.name : null,
    },
  })
}

/**
 * POST /api/grants/save — Toggle save/unsave a grant
 */
export async function POST(request: NextRequest) {
  try {
    const limited = await applyRateLimit(generalRateLimit, request)
    if (limited) return limited

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = saveGrantSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { grantId } = parsed.data

    const dbUser = await getOrCreateDbUser(user)

    // Check if already saved
    const existing = await prisma.savedGrant.findUnique({
      where: { userId_grantId: { userId: dbUser.id, grantId } },
    })

    if (existing) {
      await prisma.savedGrant.delete({ where: { id: existing.id } })
      return NextResponse.json({ saved: false })
    } else {
      const plan = await getUserPlan(dbUser.id)
      const limits = planLimits(plan)

      if (limits.maxSavedGrants !== Infinity) {
        const currentCount = await prisma.savedGrant.count({ where: { userId: dbUser.id } })
        if (currentCount >= limits.maxSavedGrants) {
          return NextResponse.json(
            {
              error: `Elérted a mentési limitet (${limits.maxSavedGrants}). Válts PRO csomagra a korlátlan mentésért.`,
              code: 'PLAN_LIMIT_EXCEEDED',
              limit: limits.maxSavedGrants,
            },
            { status: 403 },
          )
        }
      }

      await prisma.savedGrant.create({
        data: { userId: dbUser.id, grantId },
      })
      return NextResponse.json({ saved: true })
    }
  } catch (error) {
    return handleApiError(error, 'Grants Save')
  }
}

/**
 * PATCH /api/grants/save — Save preparation checklist & notes for a grant
 */
export async function PATCH(request: NextRequest) {
  try {
    const limited = await applyRateLimit(generalRateLimit, request)
    if (limited) return limited

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = updateSavedGrantChecklistSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { grantId, checkedDocs, notes } = parsed.data
    const dbUser = await getOrCreateDbUser(user)

    const existing = await prisma.savedGrant.findUnique({
      where: { userId_grantId: { userId: dbUser.id, grantId } },
    })

    if (!existing) {
      // Enforce plan limit if creating a new SavedGrant row
      const plan = await getUserPlan(dbUser.id)
      const limits = planLimits(plan)
      if (limits.maxSavedGrants !== Infinity) {
        const currentCount = await prisma.savedGrant.count({ where: { userId: dbUser.id } })
        if (currentCount >= limits.maxSavedGrants) {
          return NextResponse.json(
            {
              error: `Elérted a mentési limitet (${limits.maxSavedGrants}). Válts PRO csomagra a korlátlan mentésért.`,
              code: 'PLAN_LIMIT_EXCEEDED',
              limit: limits.maxSavedGrants,
            },
            { status: 403 },
          )
        }
      }
    }

    const prevState = parseSavedGrantState(existing?.notes)
    const nextNotes = serializeSavedGrantState({
      notes: notes !== undefined ? notes : prevState.notes,
      checkedDocs,
    })

    const saved = await prisma.savedGrant.upsert({
      where: { userId_grantId: { userId: dbUser.id, grantId } },
      update: { notes: nextNotes },
      create: { userId: dbUser.id, grantId, notes: nextNotes },
    })

    return NextResponse.json({
      saved: true,
      state: parseSavedGrantState(saved.notes),
    })
  } catch (error) {
    return handleApiError(error, 'Grants Save PATCH')
  }
}

/**
 * GET /api/grants/save — Get all saved grant IDs (or state for a single grantId) for current user
 */
export async function GET(request: NextRequest) {
  try {
    const limited = await applyRateLimit(generalRateLimit, request)
    if (limited) return limited

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
    if (!dbUser) {
      return NextResponse.json({ savedIds: [], savedMap: {} })
    }

    const saved = await prisma.savedGrant.findMany({
      where: { userId: dbUser.id },
      select: { grantId: true, notes: true },
    })

    const savedMap: Record<string, { notes: string; checkedDocs: string[] }> = {}
    for (const s of saved) {
      savedMap[s.grantId] = parseSavedGrantState(s.notes)
    }

    return NextResponse.json({
      savedIds: saved.map(s => s.grantId),
      savedMap,
    })
  } catch (error) {
    return handleApiError(error, 'Grants Save GET')
  }
}
