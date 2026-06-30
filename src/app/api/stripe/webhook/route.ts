import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as unknown as Record<string, unknown>
        const customerId = subscription.customer as string

        // Find user by Stripe customer ID
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (!user) {
          console.error(`No user found for customer ${customerId}`)
          break
        }

        // Determine plan from price ID
        const items = subscription.items as { data: Array<{ price: { id: string } }> }
        const priceId = items?.data?.[0]?.price?.id
        let plan: 'FREE' | 'PRO' | 'AGENCY' = 'FREE'
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = 'PRO'
        else if (priceId === process.env.STRIPE_AGENCY_PRICE_ID) plan = 'AGENCY'

        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {
            stripeSubscriptionId: subscription.id as string,
            stripePriceId: priceId || '',
            plan,
            status: subscription.status as string,
            currentPeriodEnd: new Date(((subscription.current_period_end as number) || Math.floor(Date.now() / 1000) + 30 * 24 * 3600) * 1000),
            cancelAtPeriodEnd: (subscription.cancel_at_period_end as boolean) || false,
          },
          create: {
            userId: user.id,
            stripeSubscriptionId: subscription.id as string,
            stripePriceId: priceId || '',
            plan,
            status: subscription.status as string,
            currentPeriodEnd: new Date(((subscription.current_period_end as number) || Math.floor(Date.now() / 1000) + 30 * 24 * 3600) * 1000),
          },
        })

        console.log(`[Stripe] Updated subscription for user ${user.email}: ${plan} (${subscription.status})`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as unknown as Record<string, unknown>
        const customerId = subscription.customer as string

        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (user) {
          await prisma.subscription.update({
            where: { userId: user.id },
            data: {
              status: 'canceled',
              plan: 'FREE',
            },
          })
          console.log(`[Stripe] Canceled subscription for user ${user.email}`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (user) {
          await prisma.subscription.update({
            where: { userId: user.id },
            data: { status: 'past_due' },
          })
          console.log(`[Stripe] Payment failed for user ${user.email}`)
        }
        break
      }
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
