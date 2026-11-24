import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { CreditCard, Check, ArrowUpRight } from 'lucide-react'
import { PLANS, formatPlanPriceHuf, type PlanKey } from '@/lib/stripe'
import { UpgradeButton } from '@/components/UpgradeButton'

export const dynamic = 'force-dynamic'

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

  const currentPlan = (subscription?.plan || 'FREE') as PlanKey
  const plan = PLANS[currentPlan]
  const currentPrice = formatPlanPriceHuf(currentPlan)
  const proPrice = formatPlanPriceHuf('PRO')
  const agencyPrice = formatPlanPriceHuf('AGENCY')

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Előfizetés és számlázás</h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
          Csomagkezelés, számlák és csomagváltás — árak forintban, nettó + ÁFA (bruttó) bontásban
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="card p-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4" style={{ color: 'var(--gr-primary)' }} />
              <span className="text-sm font-bold">Jelenlegi csomag</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold" style={{ color: 'var(--gr-primary)' }}>
                {plan.name}
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--gr-text-2)' }}>
                {currentPrice.main} {currentPrice.unit}
                {currentPrice.brutto ? ` (${currentPrice.brutto})` : ''}
              </span>
            </div>
          </div>

          {currentPlan === 'FREE' ? (
            <UpgradeButton
              plan="PRO"
              label={`Váltás Pro csomagra (${proPrice.main} + ÁFA / hó)`}
              className="text-xs py-2.5 px-4"
            />
          ) : (
            <form action="/api/stripe/portal" method="POST">
              <button type="submit" className="btn-secondary text-xs py-2 px-4">
                Számlázási portál megnyitása <ArrowUpRight className="w-3 h-3" />
              </button>
            </form>
          )}
        </div>

        <div className="border-t pt-4" style={{ borderColor: 'var(--gr-border)' }}>
          <div className="text-xs font-medium mb-3" style={{ color: 'var(--gr-text-2)' }}>
            A jelenlegi csomagod tartalmazza:
          </div>
          <ul className="space-y-2">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--gr-green)' }} />
                <span style={{ color: 'var(--gr-text-2)' }}>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Upgrade Options for Free / Pro Users */}
      {currentPlan !== 'AGENCY' && (
        <div className="grid md:grid-cols-2 gap-4">
          {currentPlan === 'FREE' && (
            <div
              className="card p-6 flex flex-col justify-between"
              style={{ borderColor: 'var(--gr-primary)', background: 'var(--gr-blue-bg)' }}
            >
              <div>
                <span className="pill pill-blue mb-2">Ajánlott KKV-knak</span>
                <h3 className="text-base font-bold mb-1">
                  Pro csomag — {proPrice.main} {proPrice.unit}
                </h3>
                <p className="text-xs mb-2" style={{ color: 'var(--gr-text-3)' }}>
                  ({proPrice.brutto})
                </p>
                <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                  {PLANS.PRO.audience}
                </p>
              </div>
              <UpgradeButton plan="PRO" label="Pro előfizetés indítása" className="w-full py-2.5 text-xs" />
            </div>
          )}

          <div className="card p-6 flex flex-col justify-between">
            <div>
              <span className="pill pill-muted mb-2">Pályázatíróknak és tanácsadóknak</span>
              <h3 className="text-base font-bold mb-1">
                Agency csomag — {agencyPrice.main} {agencyPrice.unit}
              </h3>
              <p className="text-xs mb-2" style={{ color: 'var(--gr-text-3)' }}>
                ({agencyPrice.brutto})
              </p>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                {PLANS.AGENCY.audience}
              </p>
            </div>
            <UpgradeButton
              plan="AGENCY"
              variant="secondary"
              label="Agency előfizetés indítása"
              className="w-full py-2.5 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  )
}
