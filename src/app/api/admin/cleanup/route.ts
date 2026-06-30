import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(request: NextRequest) {
  const secret = process.env.ADMIN_CLEANUP_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'ADMIN_CLEANUP_SECRET is not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Body must be an array of grant IDs (strings)
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be an array of grant IDs' }, { status: 400 })
  }

  const ids: string[] = body.filter((id): id is string => typeof id === 'string' && id.length > 0)

  if (!ids.length) {
    return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 })
  }

  const result = await prisma.grant.deleteMany({
    where: { id: { in: ids } },
  })

  return NextResponse.json({ deleted: result.count })
}
