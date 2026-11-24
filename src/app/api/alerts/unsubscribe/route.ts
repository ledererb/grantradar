import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyUnsubscribeToken } from '@/lib/alerts-mailer'
import { parseUserProfile, serializeRegionPrefsWithMeta } from '@/lib/grant-handbook'

async function handleUnsubscribe(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  if (!uid || !token || !verifyUnsubscribeToken(uid, token)) {
    return NextResponse.redirect(new URL('/leiratkozas?status=invalid', request.url))
  }

  const profile = await prisma.userProfile.findUnique({ where: { userId: uid } })
  const parsed = parseUserProfile(profile)
  parsed.alertFrequency = 'OFF'
  const regionPrefs = serializeRegionPrefsWithMeta(parsed)

  await prisma.userProfile.upsert({
    where: { userId: uid },
    update: { regionPrefs },
    create: {
      userId: uid,
      companySizePref: [],
      sectorPrefs: [],
      regionPrefs,
    },
  })

  return NextResponse.redirect(new URL('/leiratkozas?status=ok', request.url))
}

export async function GET(request: NextRequest) {
  return handleUnsubscribe(request)
}

export async function POST(request: NextRequest) {
  return handleUnsubscribe(request)
}
