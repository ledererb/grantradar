import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { generalRateLimit, applyRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/stripe/portal — Redirect to Stripe Customer Portal
 */
export async function POST(request: Request) {
  const limited = await applyRateLimit(generalRateLimit, request)
  if (limited) return limited

  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    })

    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })

    if (!portalSession.url) {
      return NextResponse.json({ error: 'No portal URL returned' }, { status: 502 })
    }

    return NextResponse.redirect(portalSession.url)
  } catch (error) {
    console.error('[Stripe Portal] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
