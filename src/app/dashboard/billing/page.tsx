import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { CreditCard, Check, ArrowUpRight } from 'lucide-react'
import { PLANS } from '@/lib/stripe'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let subscription = null
  if (user) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: { subscription: true },
    })
    subscription = dbUser?.subscription
  }

  const currentPlan = subscription?.plan || 'FREE'
  const plan = PLANS[currentPlan as keyof typeof PLANS]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Előfizetés</h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
          Kezelj csomagot és számlázást
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4" style={{ color: 'var(--gr-gold)' }} />
              <span className="text-sm font-bold">Jelenlegi csomag</span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold" style={{ color: 'var(--gr-gold)' }}>
                {plan.name}
              </span>
              <span className="text-xs" style={{ color: 'var(--gr-text-3)' }}>
                {plan.price === 0 ? 'Ingyenes' : `€${plan.price}/hó`}
              </span>
            </div>
          </div>
          {currentPlan === 'FREE' ? (
            <Link href="/pricing" className="btn-primary text-xs py-2 px-4">
              Csomag váltás <ArrowUpRight className="w-3 h-3" />
            </Link>
          ) : (
            <form action="/api/stripe/portal" method="POST">
              <button type="submit" className="btn-secondary text-xs py-2 px-4">
                Stripe kezelőpanel <ArrowUpRight className="w-3 h-3" />
              </button>
            </form>
          )}
        </div>

        <div className="border-t pt-4" style={{ borderColor: 'var(--gr-border)' }}>
          <div className="text-xs font-medium mb-3" style={{ color: 'var(--gr-text-2)' }}>
            Tartalmazza:
          </div>
          <ul className="space-y-2">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5" style={{ color: 'var(--gr-gold)' }} />
                <span style={{ color: 'var(--gr-text-2)' }}>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Upgrade Prompt for Free Users */}
      {currentPlan === 'FREE' && (
        <div className="card p-6"
          style={{ borderColor: 'var(--gr-gold-dim)', background: 'var(--gr-gold-muted)' }}>
          <h3 className="text-sm font-bold mb-2">Pro-ra váltanál?</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--gr-text-2)' }}>
            Korlátlan keresés, e-mail értesítések, mentett szűrők és export funkciók.
          </p>
          <Link href="/pricing" className="btn-primary text-sm py-2.5 px-6">
            Csomagok megtekintése
          </Link>
        </div>
      )}
    </div>
  )
}
