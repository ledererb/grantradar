import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { updateProfileSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/errors'
import { parseUserProfile, serializeRegionPrefsWithMeta } from '@/lib/grant-handbook'
import type { CompanySize } from '@prisma/client'

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

    const parsedProfile = parseUserProfile(dbUser?.profile)

    return NextResponse.json({
      profile: dbUser?.profile ? parsedProfile : null,
    })
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

    // Ensure the User row exists even if user signed in via password without OAuth callback
    const dbUser = await prisma.user.upsert({
      where: { supabaseId: user.id },
      update: {},
      create: {
        supabaseId: user.id,
        email: user.email || `${user.id}@grantradar.local`,
        name: user.user_metadata?.name || null,
      },
    })

    const parsed = updateProfileSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const body = parsed.data
    const regionPrefs = serializeRegionPrefsWithMeta(body)
    const companySizePref = (body.companySizePref || []) as CompanySize[]

    const profile = await prisma.userProfile.upsert({
      where: { userId: dbUser.id },
      update: {
        companyName: body.companyName || null,
        taxNumber: body.taxNumber || null,
        companySizePref,
        sectorPrefs: body.sectorPrefs || [],
        regionPrefs,
      },
      create: {
        userId: dbUser.id,
        companyName: body.companyName || null,
        taxNumber: body.taxNumber || null,
        companySizePref,
        sectorPrefs: body.sectorPrefs || [],
        regionPrefs,
      },
    })

    return NextResponse.json({ profile: parseUserProfile(profile) })
  } catch (error) {
    return handleApiError(error, 'Profile PUT')
  }
}
