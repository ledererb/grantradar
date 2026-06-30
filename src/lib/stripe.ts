import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
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
      'Havi 10 pályázat megtekintése',
      'Alapszintű keresés',
      'Heti hírlevél',
    ],
    limits: {
      grantsPerMonth: 10,
      savedGrants: 3,
      alerts: false,
      aiSummaries: false,
      semanticSearch: false,
      export: false,
      profiles: 0,
    },
  },
  PRO: {
    name: 'Pro',
    nameEn: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 29,
    currency: 'eur',
    features: [
      'Korlátlan pályázat megtekintése',
      'AI összefoglalók és elemzések',
      'Szemantikus keresés',
      'E-mail értesítések',
      'Szűrés szektoronként és méretenként',
      '1 cégprofil',
      'Mentett pályázatok',
    ],
    limits: {
      grantsPerMonth: Infinity,
      savedGrants: 50,
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
