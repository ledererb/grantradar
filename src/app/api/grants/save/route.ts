import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { generalRateLimit, applyRateLimit } from '@/lib/rate-limit'
import { getUserPlan, planLimits } from '@/lib/plan-limits'
import { saveGrantSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/errors'

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

    // Find our user
    const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already saved
    const existing = await prisma.savedGrant.findUnique({
      where: { userId_grantId: { userId: dbUser.id, grantId } },
    })

    if (existing) {
      // Unsave
      await prisma.savedGrant.delete({ where: { id: existing.id } })
      return NextResponse.json({ saved: false })
    } else {
      // Save — enforce plan limit on max saved grants for FREE users
      const plan = await getUserPlan(dbUser.id)
      const limits = planLimits(plan)

      if (limits.maxSavedGrants !== Infinity) {
        const currentCount = await prisma.savedGrant.count({ where: { userId: dbUser.id } })
        if (currentCount >= limits.maxSavedGrants) {
          return NextResponse.json(
            {
              error: `Saved grant limit reached (${limits.maxSavedGrants}). Upgrade to PRO for unlimited saves.`,
              code: 'PLAN_LIMIT_EXCEEDED',
              limit: limits.maxSavedGrants,
            },
            { status: 403 },
          )
        }
      }

      // Save
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
 * GET /api/grants/save — Get all saved grant IDs for current user
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
      return NextResponse.json({ savedIds: [] })
    }

    const saved = await prisma.savedGrant.findMany({
      where: { userId: dbUser.id },
      select: { grantId: true },
    })

    return NextResponse.json({ savedIds: saved.map(s => s.grantId) })
  } catch (error) {
    return handleApiError(error, 'Grants Save GET')
  }
}
