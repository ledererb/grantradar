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
    currency: 'eur',
    features: [
      'Pályázatok böngészése és szűrése',
      '5 mentett pályázat + előkészítő checklist',
      '2 perces jogosultsági előszűrő',
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
    price: 29,
    currency: 'eur',
    features: [
      'Korlátlan pályázat megtekintése és mentése',
      'AI összefoglalók, bukópontok és elemzések',
      'Szemantikus AI keresés',
      'Személyre szabott jogosultsági mátrix',
      'Pályázati és határidő értesítések',
      '1 teljes cégprofil (GINOP+ / DIMOP+ / KAP)',
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
    price: 99,
    currency: 'eur',
    features: [
      'Minden Pro funkció',
      'CSV és API export',
      'Korlátlan cégprofil',
      'White-label riportok',
      'Prioritásos támogatás',
      'Egyedi integrációk',
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
