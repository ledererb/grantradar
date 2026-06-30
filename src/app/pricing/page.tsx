import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { PLANS, type PlanKey } from '@/lib/stripe'
import { PublicNav, PublicFooter } from '@/components/public-nav'

export const metadata = { title: 'Árak — GrantRadar' }

export default function PricingPage() {
  return (
    <main className="noise min-h-screen">
      <PublicNav />

      <div className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="pill pill-gold mb-4 inline-flex">Árazás</span>
            <h1 className="headline mb-3">
              Egyszerű. <span style={{ color: 'var(--gr-gold)' }}>Átlátható.</span>
            </h1>
            <p className="text-sm" style={{ color: 'var(--gr-text-2)', maxWidth: '400px', margin: '0 auto' }}>
              Kezdd ingyen, fizess csak ha kell. Bármikor lemondható.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-0 border rounded-xl overflow-hidden" style={{ borderColor: 'var(--gr-border)' }}>
            {(['FREE', 'PRO', 'AGENCY'] as PlanKey[]).map((key, i) => {
              const plan = PLANS[key]
              const isPro = key === 'PRO'

              return (
                <div key={key} className="p-8 flex flex-col relative"
                  style={{
                    background: isPro ? 'var(--gr-bg-surface)' : 'var(--gr-bg-raised)',
                    borderRight: i < 2 ? '1px solid var(--gr-border)' : 'none',
                    borderTop: isPro ? '2px solid var(--gr-gold)' : 'none',
                  }}>
                  {isPro && (
                    <span className="absolute top-3 right-3 pill pill-gold text-[10px]">Ajánlott</span>
                  )}

                  <div className="mb-6">
                    <h3 className="text-sm font-bold mb-3">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold" style={isPro ? { color: 'var(--gr-gold)' } : {}}>
                        {plan.price === 0 ? '0' : `€${plan.price}`}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--gr-text-3)' }}>
                        {plan.price === 0 ? 'Ft / örökre' : '/ hó'}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="w-3.5 h-3.5 mt-0.5 shrink-0"
                          style={{ color: isPro ? 'var(--gr-gold)' : 'var(--gr-text-3)' }} />
                        <span style={{ color: 'var(--gr-text-2)' }}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href={key === 'FREE' ? '/register' : `/register?plan=${key.toLowerCase()}`}
                    className={isPro ? 'btn-primary w-full py-3 text-center' : 'btn-secondary w-full py-3 text-center'}>
                    {key === 'FREE' ? 'Ingyenes regisztráció' : 'Csomag kiválasztása'}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <PublicFooter />
    </main>
  )
}
