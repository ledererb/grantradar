import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { updateProfileSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/errors'

export async function GET() {
  try {
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
  } catch (error) {
    return handleApiError(error, 'Profile GET')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Validate known fields (email/name). Pass through company-specific fields
    // (companyName, taxNumber, companySizePref, sectorPrefs) which this endpoint
    // also persists.
    const parsed = updateProfileSchema.passthrough().safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const body = parsed.data as {
      companyName?: string
      taxNumber?: string
      companySizePref?: never
      sectorPrefs?: string[]
    }

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
  } catch (error) {
    return handleApiError(error, 'Profile PUT')
  }
}
