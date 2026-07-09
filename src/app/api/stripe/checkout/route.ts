import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS, type PlanKey } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { generalRateLimit, applyRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/errors'

/**
 * POST /api/stripe/checkout — Create a Stripe Checkout Session
 */
export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(generalRateLimit, request)
  if (limited) return limited

  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await request.json() as { plan: PlanKey }

    if (!plan || !PLANS[plan] || plan === 'FREE') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const planConfig = PLANS[plan]
    if (!planConfig.priceId) {
      return NextResponse.json({ error: 'Plan not configured' }, { status: 400 })
    }

    // Get or create user in our DB
    let user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          supabaseId: authUser.id,
          email: authUser.email!,
          name: authUser.user_metadata?.name || null,
        },
      })
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
          supabaseId: user.supabaseId,
        },
      })

      customerId = customer.id
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
        plan,
      },
    })

    return NextResponse.json({ url: session.url })

  } catch (error) {
    return handleApiError(error, 'Stripe Checkout')
  }
}
