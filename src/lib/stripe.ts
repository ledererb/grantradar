import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder_build', {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

export const PLANS = {
  FREE: {
    name: 'Ingyenes',
    nameEn: 'Free',
    priceId: null,
    price: 0,
    priceHuf: 0,
    priceBruttoHuf: 0,
    currency: 'huf',
    audience:
      'Vállalkozóknak és cégvezetőknek, akik gyorsan szeretnék felmérni, milyen nyitott hazai támogatásokra lehetnek jogosultak.',
    features: [
      'Nyitott magyar pályázatok böngészése és szűrése',
      '2 perces jogosultsági előszűrő',
      'Cégprofilra szabott találati lista a Pályázatok menüben',
      '5 mentett pályázat + előkészítő dokumentumlista',
    ],
    limits: {
      grantsPerMonth: 10,
      savedGrants: 5,
      alerts: false,
      aiSummaries: false,
      semanticSearch: false,
      export: false,
      profiles: 1,
    },
  },
  PRO: {
    name: 'Pro',
    nameEn: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 11900,
    priceHuf: 11900,
    priceBruttoHuf: 15113,
    currency: 'huf',
    audience:
      'Aktívan fejlődő KKV-knak, ügyvezetőknek és agrárvállalkozásoknak, akik időben értesülnének minden releváns kiírásról.',
    features: [
      'Korlátlan pályázat megtekintése és mentése',
      'Közérthető összefoglalók és tipikus bukópont-elemzések',
      'Szabadszavas AI okoskereső (leírás alapján is talál)',
      'Teljes jogosultsági mátrix + 10 pontos dokumentumlista',
      'Napi vagy heti e-mail értesítés és határidő-riasztás',
      '1 teljes cégprofil (GINOP Plusz, DIMOP Plusz, KAP)',
    ],
    limits: {
      grantsPerMonth: Infinity,
      savedGrants: Infinity,
      alerts: true,
      aiSummaries: true,
      semanticSearch: true,
      export: false,
      profiles: 1,
    },
  },
  AGENCY: {
    name: 'Agency',
    nameEn: 'Agency',
    priceId: process.env.STRIPE_AGENCY_PRICE_ID,
    price: 39900,
    priceHuf: 39900,
    priceBruttoHuf: 50673,
    currency: 'huf',
    audience:
      'Pályázatíró irodáknak, könyvelőknek és üzleti tanácsadóknak, akik több ügyfélcég pályázati jogosultságát vizsgálják.',
    features: [
      'Minden Pro csomagban elérhető funkció',
      'Több ügyfél-cégprofil kezelése',
      'Saját logós, nyomtatható PDF és CSV ügyfélriportok',
      'Adatbázis- és API-kapcsolati export',
      'Kiemelt, gyorsított ügyféltámogatás',
      'Egyedi igény szerinti adatkapcsolat',
    ],
    limits: {
      grantsPerMonth: Infinity,
      savedGrants: Infinity,
      alerts: true,
      aiSummaries: true,
      semanticSearch: true,
      export: true,
      profiles: Infinity,
    },
  },
} as const

export type PlanKey = keyof typeof PLANS

export function formatPlanPriceHuf(key: PlanKey): {
  main: string
  unit: string
  brutto: string | null
} {
  const plan = PLANS[key]
  if (plan.priceHuf === 0) {
    return { main: '0 Ft', unit: '/ örökre', brutto: null }
  }
  return {
    main: `${plan.priceHuf.toLocaleString('hu-HU')} Ft`,
    unit: '+ ÁFA / hó',
    brutto: `bruttó ${plan.priceBruttoHuf.toLocaleString('hu-HU')} Ft / hó`,
  }
}
