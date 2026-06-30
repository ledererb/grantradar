import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteGrantsSchema } from '@/lib/validations'

export async function DELETE(request: NextRequest) {
  const secret = process.env.ADMIN_CLEANUP_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'ADMIN_CLEANUP_SECRET is not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = deleteGrantsSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const ids = parsed.data.ids

  const result = await prisma.grant.deleteMany({
    where: { id: { in: ids } },
  })

  return NextResponse.json({ deleted: result.count })
}
