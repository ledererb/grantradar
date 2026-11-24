import Link from 'next/link'
import { Check, Minus, Users } from 'lucide-react'
import { PLANS, formatPlanPriceHuf, type PlanKey } from '@/lib/stripe'
import { PublicNav, PublicFooter } from '@/components/public-nav'
import { UpgradeButton } from '@/components/UpgradeButton'

export const metadata = { title: 'Árak és Csomagok (Ft) — GrantRadar' }

const COMPARISON_ROWS: {
  feature: string
  free: string
  pro: string
  agency: string
}[] = [
  {
    feature: 'Aktuális magyar pályázatok böngészése',
    free: 'Korlátlan',
    pro: 'Korlátlan (+ EU is)',
    agency: 'Korlátlan (+ EU is)',
  },
  {
    feature: '2 perces jogosultsági előszűrő',
    free: 'Igen',
    pro: 'Igen',
    agency: 'Igen',
  },
  {
    feature: 'Cégprofilra szabott találati lista',
    free: 'Igen',
    pro: 'Igen + egyezési pontszám',
    agency: 'Igen + több cégprofil',
  },
  {
    feature: 'Menthető pályázatok és dokumentumlista',
    free: 'Max. 5 db',
    pro: 'Korlátlan',
    agency: 'Korlátlan',
  },
  {
    feature: 'Közérthető összefoglalók és bukópontok',
    free: 'Alap adatok',
    pro: 'Teljes elemzés',
    agency: 'Teljes elemzés',
  },
  {
    feature: 'Szabadszavas AI okoskereső',
    free: '—',
    pro: 'Igen',
    agency: 'Igen',
  },
  {
    feature: 'E-mail értesítő (napi / heti) és határidő-riasztás',
    free: '—',
    pro: 'Igen (1 kattintással módosítható)',
    agency: 'Igen',
  },
  {
    feature: 'Kezelhető cégprofilok száma',
    free: '1 cég',
    pro: '1 cég',
    agency: 'Korlátlan ügyfélcég',
  },
  {
    feature: 'Saját logós ügyfélriport, CSV & API export',
    free: '—',
    pro: 'Nyomtatható adatlap',
    agency: 'Teljes CSV, PDF és API export',
  },
  {
    feature: 'Ügyfélszolgálat',
    free: 'E-mail',
    pro: 'E-mail (24 órán belül)',
    agency: 'Kiemelt támogatás',
  },
]

export default function PricingPage() {
  return (
    <main className="noise min-h-screen">
      <PublicNav />

      <div className="pt-28 pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="pill pill-blue mb-3 inline-flex">Árazás forintban • Nettó és bruttó árakkal</span>
            <h1 className="headline mb-3">
              Átlátható csomagok,{' '}
              <span style={{ color: 'var(--gr-primary)' }}>rejtett költségek nélkül.</span>
            </h1>
            <p className="text-sm max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
              Kezdd ingyen bankkártya nélkül. Fizetős csomagjainknál a nettó (+ 27% ÁFA) és a bruttó havi díjat is pontosan feltüntetjük. Hűségidő nincs, bármikor lemondható.
            </p>
          </div>

          {/* 3 Plan Cards */}
          <div className="grid md:grid-cols-3 gap-5 mb-16">
            {(['FREE', 'PRO', 'AGENCY'] as PlanKey[]).map((key) => {
              const plan = PLANS[key]
              const price = formatPlanPriceHuf(key)
              const isPro = key === 'PRO'

              return (
                <div
                  key={key}
                  className="card p-7 flex flex-col relative"
                  style={
                    isPro
                      ? {
                          borderColor: 'var(--gr-primary)',
                          borderWidth: '2px',
                        }
                      : {}
                  }
                >
                  {isPro && (
                    <span className="absolute top-4 right-4 pill pill-blue">Legnépszerűbb</span>
                  )}

                  <div className="mb-5">
                    <h2 className="text-lg font-bold mb-3">{plan.name}</h2>
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span
                        className="text-3xl font-extrabold tracking-tight"
                        style={{ color: isPro ? 'var(--gr-primary)' : 'var(--gr-text)' }}
                      >
                        {price.main}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--gr-text-2)' }}>
                        {price.unit}
                      </span>
                    </div>
                    {price.brutto && (
                      <div className="text-xs mt-1" style={{ color: 'var(--gr-text-3)' }}>
                        ({price.brutto})
                      </div>
                    )}
                  </div>

                  {/* Who is it for? */}
                  <div
                    className="p-3.5 rounded-lg border mb-6 text-xs leading-relaxed"
                    style={{
                      background: 'var(--gr-bg-surface)',
                      borderColor: 'var(--gr-border)',
                      color: 'var(--gr-text-2)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1" style={{ color: 'var(--gr-text)' }}>
                      <Users className="w-3.5 h-3.5" style={{ color: 'var(--gr-primary)' }} />
                      Kinek szól?
                    </div>
                    {plan.audience}
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <Check
                          className="w-4 h-4 mt-0.5 shrink-0"
                          style={{ color: isPro ? 'var(--gr-primary)' : 'var(--gr-green)' }}
                        />
                        <span style={{ color: 'var(--gr-text-2)' }}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {key === 'FREE' ? (
                    <Link href="/register" className="btn-secondary w-full py-3 text-center">
                      Ingyenes regisztráció
                    </Link>
                  ) : (
                    <UpgradeButton
                      plan={key}
                      variant={isPro ? 'primary' : 'secondary'}
                      label="Csomag kiválasztása"
                      className="w-full py-3"
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Detailed Comparison Table */}
          <section className="mb-16" aria-labelledby="comparison-heading">
            <div className="text-center mb-6">
              <h2 id="comparison-heading" className="text-xl font-bold tracking-tight mb-1">
                Csomagok részletes összehasonlítása
              </h2>
              <p className="text-xs" style={{ color: 'var(--gr-text-2)' }}>
                Minden funkció egy táblázatban, hogy könnyen kiválaszd a cégednek megfelelőt
              </p>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby="comparison-heading"
              className="table-wrapper"
            >
              <table
                style={
                  {
                    '--label-2': '"Ingyenes"',
                    '--label-3': '"Pro"',
                    '--label-4': '"Agency"',
                  } as React.CSSProperties
                }
              >
                <thead>
                  <tr>
                    <th>Funkció / Szolgáltatás</th>
                    <th>Ingyenes (0 Ft)</th>
                    <th>Pro (11 900 Ft + ÁFA / hó)</th>
                    <th>Agency (39 900 Ft + ÁFA / hó)</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <th>{row.feature}</th>
                      <td style={{ color: row.free === '—' ? 'var(--gr-text-3)' : 'var(--gr-text-2)' }}>
                        {row.free === '—' ? <Minus className="w-4 h-4" aria-label="Nem tartalmazza" /> : row.free}
                      </td>
                      <td style={{ color: 'var(--gr-text)', fontWeight: 500 }}>{row.pro}</td>
                      <td style={{ color: 'var(--gr-text)', fontWeight: 500 }}>{row.agency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pricing FAQ */}
          <section aria-labelledby="pricing-faq-heading">
            <h2 id="pricing-faq-heading" className="text-xl font-bold tracking-tight mb-4 text-center">
              Gyakori kérdések a számlázásról
            </h2>
            <div className="faq-accordion space-y-3 max-w-3xl mx-auto">
              <details>
                <summary>Nettó vagy bruttó árakat tüntettek fel?</summary>
                <div className="faq-body">
                  Vállalkozások számára a nettó árat (+ 27% ÁFA) emeljük ki, és minden csomagnál pontosan feltüntetjük alatta a bruttó fizetendő végösszeget is (Pro: nettó 11 900 Ft, bruttó 15 113 Ft / hó; Agency: nettó 39 900 Ft, bruttó 50 673 Ft / hó).
                </div>
              </details>
              <details>
                <summary>ÁFA-s számlát kap a vállalkozásom?</summary>
                <div className="faq-body">
                  Igen, minden előfizetésről elektronikus, céges költségként elszámolható számlát állítunk ki a fizetési folyamat során megadott cégadatokra.
                </div>
              </details>
              <details>
                <summary>Mikor mondhatom le, vagy válthatok csomagot?</summary>
                <div className="faq-body">
                  Bármikor, egy kattintással az Előfizetés menüpontban. Nincs hűségidő vagy rejtett felmondási díj; lemondás esetén a már kifizetett hónap végéig teljes körűen használhatod a rendszert.
                </div>
              </details>
            </div>
          </section>
        </div>
      </div>

      <PublicFooter />
    </main>
  )
}
