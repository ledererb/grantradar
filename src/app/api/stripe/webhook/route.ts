import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'

function resolvePlanFromPriceId(priceId: string | undefined): 'FREE' | 'PRO' | 'AGENCY' {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'PRO'
  if (priceId === process.env.STRIPE_AGENCY_PRICE_ID) return 'AGENCY'
  return 'FREE'
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (!user) {
          console.error(`No user found for customer ${customerId}`)
          break
        }

        const firstItem = subscription.items.data[0]
        const priceId = firstItem?.price?.id
        const plan = resolvePlanFromPriceId(priceId)

        const periodEnd = firstItem?.current_period_end
        const currentPeriodEnd = periodEnd
          ? new Date(periodEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 3600 * 1000)

        await prisma.subscription.upsert({
          where: { userId: user.id },
          update: {
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId || '',
            plan,
            status: subscription.status,
            currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
          create: {
            userId: user.id,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId || '',
            plan,
            status: subscription.status,
            currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
        })

        console.log(
          `[Stripe] ${event.type} for user ${user.email}: ${plan} (${subscription.status})` +
            (subscription.cancel_at_period_end ? ' [cancel_at_period_end]' : ''),
        )
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (user) {
          // Subscription was actually deleted — deactivate and downgrade to FREE.
          await prisma.subscription.update({
            where: { userId: user.id },
            data: {
              status: 'canceled',
              plan: 'FREE',
              cancelAtPeriodEnd: false,
            },
          })
          console.log(`[Stripe] Canceled subscription for user ${user.email}`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customer = invoice.customer
        const customerId =
          typeof customer === 'string' ? customer : customer?.id

        if (!customerId) break

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
