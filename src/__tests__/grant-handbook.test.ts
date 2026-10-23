import { describe, it, expect } from 'vitest'
import {
  serializeRegionPrefsWithMeta,
  parseUserProfile,
  parseSavedGrantState,
  serializeSavedGrantState,
  classifyGrantProgram,
  evaluateGrantEligibility,
  DEFAULT_PRE_SCREEN_PROFILE,
} from '@/lib/grant-handbook'
import { buildAlertDigestHtml } from '@/lib/alerts-mailer'

describe('UserProfile pre-screening metadata serialization', () => {
  it('round-trips extended profile fields via regionPrefs', () => {
    const input = {
      ...DEFAULT_PRE_SCREEN_PROFILE,
      companyName: 'Teszt Kft.',
      taxNumber: '12345678-2-42',
      companySizePref: ['SMALL'],
      sectorPrefs: ['Feldolgozóipar'],
      regions: ['Budapest / Pest vármegye'],
      legalForm: 'KFT_ZRT' as const,
      closedFiscalYears: 2,
      headcount: 14,
      annualRevenueM: 180,
      positiveEquity: 'YES' as const,
      noTaxDebt: 'YES' as const,
      locationRight: 'OWNED' as const,
      ownContributionPct: 50,
      deMinimisUsedEur: 15000,
      isAgriProducer: true,
      hasKnyr: 'YES' as const,
      steValue: 12000,
      agriRevenuePct: 60,
      hasUnifiedApplication: 'YES' as const,
    }

    const regionPrefs = serializeRegionPrefsWithMeta(input)
    expect(regionPrefs).toContain('Budapest / Pest vármegye')
    expect(regionPrefs).toContain('meta:legalForm=KFT_ZRT')
    expect(regionPrefs).toContain('meta:closedFiscalYears=2')

    const parsed = parseUserProfile({
      companyName: input.companyName,
      taxNumber: input.taxNumber,
      companySizePref: input.companySizePref,
      sectorPrefs: input.sectorPrefs,
      regionPrefs,
    })

    expect(parsed).toEqual(input)
  })
})

describe('SavedGrant checklist state serialization', () => {
  it('parses legacy plain-text notes gracefully', () => {
    const state = parseSavedGrantState('Sima szöveges jegyzet')
    expect(state).toEqual({
      notes: 'Sima szöveges jegyzet',
      checkedDocs: [],
    })
  })

  it('round-trips JSON checklist and notes', () => {
    const raw = serializeSavedGrantState({
      notes: 'Árajánlat bekérve',
      checkedDocs: ['ceg_jogallas', 'penzugy_beszamolo'],
    })
    const parsed = parseSavedGrantState(raw)
    expect(parsed).toEqual({
      notes: 'Árajánlat bekérve',
      checkedDocs: ['ceg_jogallas', 'penzugy_beszamolo'],
    })
  })
})

describe('classifyGrantProgram', () => {
  it('identifies GINOP Plusz grants', () => {
    const res = classifyGrantProgram({
      code: 'GINOP_PLUSZ-1.2.4-25',
      titleHu: 'Mikro- és kisvállalkozások támogatása',
    })
    expect(res.family).toBe('GINOP_PLUSZ')
  })

  it('identifies DIMOP Plusz grants', () => {
    const res = classifyGrantProgram({
      code: 'DIMOP_PLUSZ-1.2.6-24',
      titleHu: 'KKV-k digitális intenzitásának növelése',
    })
    expect(res.family).toBe('DIMOP_PLUSZ')
  })

  it('identifies KAP agricultural grants', () => {
    const res = classifyGrantProgram({
      code: 'KAP-RD09a-2-26',
      titleHu: 'Mezőgazdasági kisüzemek beruházási támogatása',
    })
    expect(res.family).toBe('KAP')
  })
})

describe('evaluateGrantEligibility', () => {
  it('flags FAIL when negative equity or tax debt is reported', () => {
    const evaluation = evaluateGrantEligibility(
      {
        code: 'GINOP_PLUSZ-1.2.4-25',
        titleHu: 'KKV technológiai korszerűsítés',
        minAmountHuf: BigInt(10_000_000),
        maxAmountHuf: BigInt(50_000_000),
        supportIntensityPct: 50,
        eligibleSizes: ['MICRO', 'SMALL'],
      },
      {
        ...DEFAULT_PRE_SCREEN_PROFILE,
        companySizePref: ['SMALL'],
        legalForm: 'KFT_ZRT',
        closedFiscalYears: 2,
        headcount: 10,
        annualRevenueM: 100,
        positiveEquity: 'NO',
        noTaxDebt: 'YES',
      },
    )

    expect(evaluation.failCount).toBeGreaterThan(0)
    expect(evaluation.verdictTone).toBe('red')
  })

  it('passes all checks for a strong SME profile on a matching GINOP Plusz grant', () => {
    const evaluation = evaluateGrantEligibility(
      {
        code: 'GINOP_PLUSZ-1.2.4-25',
        titleHu: 'KKV technológiai korszerűsítés',
        minAmountHuf: BigInt(10_000_000),
        maxAmountHuf: BigInt(50_000_000),
        supportIntensityPct: 50,
        eligibleSizes: ['MICRO', 'SMALL', 'MEDIUM'],
      },
      {
        ...DEFAULT_PRE_SCREEN_PROFILE,
        companySizePref: ['SMALL'],
        legalForm: 'KFT_ZRT',
        closedFiscalYears: 3,
        headcount: 15,
        annualRevenueM: 150,
        positiveEquity: 'YES',
        noTaxDebt: 'YES',
        regions: ['Kevésbé fejlett régió (Észak-Magyarország, Észak-Alföld, Dél-Alföld, Dél-Dunántúl)'],
        locationRight: 'OWNED',
        ownContributionPct: 60,
      },
    )

    expect(evaluation.failCount).toBe(0)
    expect(evaluation.warnCount).toBe(0)
    expect(evaluation.verdictTone).toBe('green')
  })
})

describe('buildAlertDigestHtml', () => {
  it('generates subject and HTML with new grants and approaching deadlines', () => {
    const { subject, html } = buildAlertDigestHtml(
      'Példa Kft.',
      [
        {
          id: 'g1',
          code: 'GINOP_PLUSZ-1.2.4-25',
          title: 'KKV technológiai korszerűsítés',
          deadline: new Date('2026-11-15'),
          maxAmountHuf: BigInt(50_000_000),
          verdictLabel: 'Kiváló illeszkedés',
          type: 'NEW_GRANT',
        },
        {
          id: 'g2',
          code: 'KAP-RD09a-2-26',
          title: 'Mezőgazdasági kisüzemek beruházási támogatása',
          deadline: new Date('2026-10-30'),
          maxAmountHuf: BigInt(10_000_000),
          verdictLabel: 'Mentett pályázat — 14 napon belül lejár',
          type: 'DEADLINE_APPROACHING',
        },
      ],
      'https://grantradar.hu',
    )

    expect(subject).toContain('1 új releváns pályázat')
    expect(subject).toContain('1 közelgő határidő')
    expect(html).toContain('Példa Kft.')
    expect(html).toContain('GINOP_PLUSZ-1.2.4-25')
    expect(html).toContain('KAP-RD09a-2-26')
  })
})
