import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { generalRateLimit, applyRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/grants/save — Toggle save/unsave a grant
 */
export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(generalRateLimit, request)
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { grantId } = await request.json()
  if (!grantId) {
    return NextResponse.json({ error: 'grantId required' }, { status: 400 })
  }

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
    // Save
    await prisma.savedGrant.create({
      data: { userId: dbUser.id, grantId },
    })
    return NextResponse.json({ saved: true })
  }
}

/**
 * GET /api/grants/save — Get all saved grant IDs for current user
 */
export async function GET(request: NextRequest) {
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
}
