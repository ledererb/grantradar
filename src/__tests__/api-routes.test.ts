import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  grantFindMany: vi.fn(),
  grantCount: vi.fn(),
  userFindUnique: vi.fn(),
  userUpsert: vi.fn(),
  userProfileFindUnique: vi.fn(),
  userProfileUpsert: vi.fn(),
  pgPoolQuery: vi.fn(),
  getUserPlan: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    grant: {
      findMany: mocks.grantFindMany,
      count: mocks.grantCount,
    },
    user: {
      findUnique: mocks.userFindUnique,
      upsert: mocks.userUpsert,
    },
    userProfile: {
      findUnique: mocks.userProfileFindUnique,
      upsert: mocks.userProfileUpsert,
    },
  },
  pgPool: {
    query: mocks.pgPoolQuery,
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}))

vi.mock('@/lib/rate-limit', () => ({
  searchRateLimit: null,
  generalRateLimit: null,
  applyRateLimit: vi.fn(async () => null),
}))

vi.mock('@/lib/plan-limits', () => ({
  getUserPlan: mocks.getUserPlan,
  planLimits: (plan: string) => ({
    maxSavedGrants: plan === 'FREE' ? 5 : Infinity,
    alerts: plan !== 'FREE',
    aiSummaries: plan !== 'FREE',
    semanticSearch: plan !== 'FREE',
    export: plan === 'AGENCY',
    profiles: plan === 'AGENCY' ? Infinity : 1,
  }),
}))

import { GET as grantsGet } from '@/app/api/grants/route'
import { GET as profileGet, PUT as profilePut } from '@/app/api/profile/route'
import { GET as unsubscribeGet } from '@/app/api/alerts/unsubscribe/route'
import { createUnsubscribeToken } from '@/lib/alerts-mailer'
import { formatPlanPriceHuf } from '@/lib/stripe'

function makeGrant(overrides: Partial<{
  id: string
  code: string | null
  program: string | null
  titleHu: string | null
  titleEn: string | null
  status: string
  fundingType: string
  deadline: Date | null
  openDate: Date | null
  minAmountHuf: bigint | null
  maxAmountHuf: bigint | null
  maxAmountEur: number | null
  supportIntensityPct: number | null
  eligibleSizes: string[]
  eligibleSectors: string[]
  eligibleRegions: string[]
  eligibilityHu: string | null
  descriptionHu: string | null
  aiSummaryHu: string | null
  aiSectors: string[]
  firstSeenAt: Date
  source: { name: string; country: string; slug: string }
}>) {
  return {
    id: 'g-1',
    code: 'GINOP_PLUSZ-1.2.4-25',
    program: 'GINOP Plusz',
    titleHu: 'KKV technológiai fejlesztés',
    titleEn: null,
    status: 'OPEN',
    fundingType: 'GRANT',
    deadline: new Date('2027-06-01T00:00:00Z'),
    openDate: new Date('2026-01-01T00:00:00Z'),
    minAmountHuf: BigInt(10_000_000),
    maxAmountHuf: BigInt(50_000_000),
    maxAmountEur: null,
    supportIntensityPct: 50,
    eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
    eligibleSectors: ['Feldolgozóipar'],
    eligibleRegions: [],
    eligibilityHu: 'Pályázók köre: KKV, gazdasági társaság.',
    descriptionHu: 'KKV beruházási támogatás.',
    aiSummaryHu: 'KKV beruházási összefoglaló.',
    aiSectors: ['Feldolgozóipar'],
    firstSeenAt: new Date('2026-05-01T00:00:00Z'),
    source: { name: 'palyazat.gov.hu', country: 'HU', slug: 'palyazat-gov-hu' },
    ...overrides,
  }
}

describe('API route handlers integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    mocks.getUserPlan.mockResolvedValue('FREE')
    mocks.grantCount.mockResolvedValue(0)
  })

  it('GET /api/grants excludes technical calls & ranks open Hungarian core programs above forthcoming ones', async () => {
    const openGinop = makeGrant({
      id: 'g-open',
      code: 'GINOP_PLUSZ-1.2.4-25',
      status: 'OPEN',
      deadline: new Date('2027-03-01T00:00:00Z'),
    })
    const forthcomingKap = makeGrant({
      id: 'g-forth',
      code: 'KAP-RD09a-2-27',
      program: 'KAP',
      titleHu: 'Tervezett agrár beruházás',
      status: 'FORTHCOMING',
      deadline: new Date('2027-08-01T00:00:00Z'),
      openDate: new Date('2027-01-01T00:00:00Z'),
    })
    const technicalHvsz = makeGrant({
      id: 'g-tech',
      code: 'DIMOP_PLUSZ-1.2.3/AB-2-24',
      titleHu: 'HVSZ és Közvetítők költségtérítése DIMOP Plusz 1. prioritás',
      status: 'OPEN',
    })

    mocks.grantFindMany.mockResolvedValueOnce([forthcomingKap, technicalHvsz, openGinop])

    const req = new NextRequest('http://localhost:3000/api/grants?status=ACTIVE&country=HU&sort=relevance')
    const res = await grantsGet(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.grants.map((g: { id: string }) => g.id)).toEqual(['g-open', 'g-forth'])
  })

  it('GET /api/grants surfaces closedMatchCount for DIMOP Plusz-1.2.6/C when active is empty and returns it under status=CLOSED', async () => {
    const closedDimop = makeGrant({
      id: 'g-dimop-126c',
      code: 'DIMOP_PLUSZ-1.2.6/C-26',
      program: 'DIMOP_PLUSZ',
      titleHu: 'KKV-k digitális átállása (1.2.6/C)',
      status: 'CLOSED',
      deadline: new Date('2026-10-26T00:00:00Z'),
    })

    // First call: active query returns empty, count finds 1 closed match
    mocks.grantFindMany.mockResolvedValueOnce([])
    mocks.grantCount.mockResolvedValueOnce(1)

    const activeReq = new NextRequest(
      'http://localhost:3000/api/grants?q=DIMOP%20Plusz-1.2.6%2FC&status=ACTIVE&country=HU',
    )
    const activeRes = await grantsGet(activeReq)
    expect(activeRes.status).toBe(200)
    const activeBody = await activeRes.json()
    expect(activeBody.total).toBe(0)
    expect(activeBody.closedMatchCount).toBe(1)

    // Verify Prisma where included normalized DIMOP_PLUSZ-1.2.6/C variant
    const activeWhereArg = mocks.grantFindMany.mock.calls[0][0].where
    expect(JSON.stringify(activeWhereArg)).toContain('DIMOP_PLUSZ-1.2.6/C')

    // Second call: CLOSED view returns the grant with effectiveStatus CLOSED
    mocks.grantFindMany.mockResolvedValueOnce([closedDimop])
    const closedReq = new NextRequest(
      'http://localhost:3000/api/grants?q=DIMOP%20Plusz-1.2.6%2FC&status=CLOSED&country=ALL',
    )
    const closedRes = await grantsGet(closedReq)
    expect(closedRes.status).toBe(200)
    const closedBody = await closedRes.json()
    expect(closedBody.total).toBe(1)
    expect(closedBody.grants[0].code).toBe('DIMOP_PLUSZ-1.2.6/C-26')
    expect(closedBody.grants[0].effectiveStatus).toBe('CLOSED')
  })

  it('GET /api/grants avoids false KKV matches when searching "önkormányzat" and matches full DIMOP program name', async () => {
    // 1. Municipal search uses safe fields (not free-text descriptionHu negative clause)
    mocks.grantFindMany.mockResolvedValueOnce([])
    const munReq = new NextRequest('http://localhost:3000/api/grants?q=%C3%B6nkorm%C3%A1nyzat&status=ACTIVE')
    await grantsGet(munReq)
    const munWhere = JSON.stringify(mocks.grantFindMany.mock.calls[0][0].where)
    expect(munWhere).not.toContain('descriptionHu')
    expect(munWhere).toContain('Pályázók köre: önkormányzat')
    expect(munWhere).not.toContain('Vidékfejlesztés')

    // 2. Program filter checks code/title/program/source, not only raw program field
    mocks.grantFindMany.mockResolvedValueOnce([
      makeGrant({
        id: 'g-dimop-prog',
        code: 'DIMOP_PLUSZ-1.2.6-24',
        program: 'Digitális Megújulás Operatív Program Plusz',
      }),
    ])
    const progReq = new NextRequest('http://localhost:3000/api/grants?program=DIMOP&status=ACTIVE')
    const progRes = await grantsGet(progReq)
    const progWhere = JSON.stringify(mocks.grantFindMany.mock.calls[1][0].where)
    expect(progWhere).toContain('"code"')
    expect(progWhere).toContain('"titleHu"')
    expect((await progRes.json()).total).toBe(1)
  })

  it('GET /api/grants allows forMe=1 on FREE plan while keeping semantic search PRO-gated', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'supa-1', email: 'test@ceg.hu' } } })
    mocks.getUserPlan.mockResolvedValue('FREE')
    mocks.userFindUnique.mockResolvedValue({
      id: 'u-1',
      profile: {
        companyName: 'Teszt Kft.',
        taxNumber: null,
        companySizePref: ['SMALL'],
        sectorPrefs: ['Feldolgozóipar'],
        regionPrefs: [
          'Kevésbé fejlett régió',
          'meta:legalForm=KFT_ZRT',
          'meta:closedFiscalYears=2',
          'meta:annualRevenueM=120',
          'meta:positiveEquity=YES',
          'meta:noTaxDebt=YES',
          'meta:locationRight=OWNED',
        ],
      },
    })

    const matchingGrant = makeGrant({
      id: 'g-fit',
      eligibleSizes: ['MICRO', 'SMALL'],
      eligibleSectors: ['Feldolgozóipar'],
    })
    const nonMatchingGrant = makeGrant({
      id: 'g-micro-only',
      eligibleSizes: ['MICRO'],
      eligibleSectors: ['Feldolgozóipar'],
    })
    mocks.grantFindMany.mockResolvedValueOnce([matchingGrant, nonMatchingGrant])

    const forMeReq = new NextRequest('http://localhost:3000/api/grants?forMe=1&status=ACTIVE&country=HU')
    const forMeRes = await grantsGet(forMeReq)
    expect(forMeRes.status).toBe(200)
    const forMeBody = await forMeRes.json()
    expect(forMeBody.grants.map((g: { id: string }) => g.id)).toEqual(['g-fit'])
    expect(forMeBody.grants[0].eligibilityVerdict.tone).toBe('green')

    const semReq = new NextRequest('http://localhost:3000/api/grants?semantic=napelem')
    const semRes = await grantsGet(semReq)
    expect(semRes.status).toBe(403)
    expect((await semRes.json()).code).toBe('PLAN_REQUIRED')
  })

  it('GET & PUT /api/profile persists and returns alertFrequency', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'supa-1', email: 'test@ceg.hu', user_metadata: {} } },
    })
    mocks.userUpsert.mockResolvedValue({ id: 'u-1' })
    mocks.userProfileUpsert.mockImplementation(async ({ create }) => create)

    const putReq = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Teszt KKV Kft.',
        companySizePref: ['SMALL'],
        sectorPrefs: ['Feldolgozóipar'],
        regions: ['Kevésbé fejlett régió'],
        alertFrequency: 'WEEKLY',
      }),
    })
    const putRes = await profilePut(putReq)
    expect(putRes.status).toBe(200)
    const putData = await putRes.json()
    expect(putData.profile.alertFrequency).toBe('WEEKLY')
    expect(mocks.userProfileUpsert).toHaveBeenCalledTimes(1)

    const savedRegionPrefs = mocks.userProfileUpsert.mock.calls[0][0].create.regionPrefs
    mocks.userFindUnique.mockResolvedValue({
      id: 'u-1',
      profile: {
        companyName: 'Teszt KKV Kft.',
        taxNumber: null,
        companySizePref: ['SMALL'],
        sectorPrefs: ['Feldolgozóipar'],
        regionPrefs: savedRegionPrefs,
      },
    })
    const getRes = await profileGet()
    expect(getRes.status).toBe(200)
    expect((await getRes.json()).profile.alertFrequency).toBe('WEEKLY')
  })

  it('GET /api/alerts/unsubscribe validates HMAC token and updates alertFrequency=OFF only when valid', async () => {
    mocks.userProfileFindUnique.mockResolvedValue({
      userId: 'user-abc',
      companySizePref: ['SMALL'],
      sectorPrefs: ['IT és szoftverfejlesztés'],
      regionPrefs: ['Kevésbé fejlett régió'],
    })
    mocks.userProfileUpsert.mockResolvedValue({})

    const invalidReq = new NextRequest(
      'http://localhost:3000/api/alerts/unsubscribe?uid=user-abc&token=badtoken',
    )
    const invalidRes = await unsubscribeGet(invalidReq)
    expect(invalidRes.status).toBe(307)
    expect(invalidRes.headers.get('location')).toContain('/leiratkozas?status=invalid')
    expect(mocks.userProfileUpsert).not.toHaveBeenCalled()

    const validToken = createUnsubscribeToken('user-abc')
    const validReq = new NextRequest(
      `http://localhost:3000/api/alerts/unsubscribe?uid=user-abc&token=${validToken}`,
    )
    const validRes = await unsubscribeGet(validReq)
    expect(validRes.status).toBe(307)
    expect(validRes.headers.get('location')).toContain('/leiratkozas?status=ok')
    expect(mocks.userProfileUpsert).toHaveBeenCalledTimes(1)
    expect(mocks.userProfileUpsert.mock.calls[0][0].update.regionPrefs).toContain(
      'meta:alertFrequency=OFF',
    )
  })

  it('formats HUF net and gross prices accurately', () => {
    expect(formatPlanPriceHuf('FREE')).toEqual({
      main: '0 Ft',
      unit: '/ örökre',
      brutto: null,
    })
    const pro = formatPlanPriceHuf('PRO')
    expect(pro.main.replace(/\s/g, ' ')).toBe('11 900 Ft')
    expect(pro.unit).toBe('+ ÁFA / hó')
    expect(pro.brutto?.replace(/\s/g, ' ')).toBe('bruttó 15 113 Ft / hó')

    const agency = formatPlanPriceHuf('AGENCY')
    expect(agency.main.replace(/\s/g, ' ')).toBe('39 900 Ft')
    expect(agency.unit).toBe('+ ÁFA / hó')
    expect(agency.brutto?.replace(/\s/g, ' ')).toBe('bruttó 50 673 Ft / hó')
  })
})
