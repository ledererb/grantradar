import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { profile: true },
  })

  return NextResponse.json({ profile: dbUser?.profile || null })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await request.json()

  const profile = await prisma.userProfile.upsert({
    where: { userId: dbUser.id },
    update: {
      companyName: body.companyName || null,
      taxNumber: body.taxNumber || null,
      companySizePref: body.companySizePref || [],
      sectorPrefs: body.sectorPrefs || [],
    },
    create: {
      userId: dbUser.id,
      companyName: body.companyName || null,
      taxNumber: body.taxNumber || null,
      companySizePref: body.companySizePref || [],
      sectorPrefs: body.sectorPrefs || [],
    },
  })

  return NextResponse.json({ profile })
}
