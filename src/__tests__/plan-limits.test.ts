import { describe, it, expect } from 'vitest'
import { PLAN_LIMITS } from '@/lib/plan-limits'

describe('PLAN_LIMITS', () => {
  it('FREE has max 5 saved grants', () => {
    expect(PLAN_LIMITS.FREE.maxSavedGrants).toBe(5)
  })

  it('FREE has no semantic search', () => {
    expect(PLAN_LIMITS.FREE.semanticSearch).toBe(false)
  })

  it('FREE has no alerts', () => {
    expect(PLAN_LIMITS.FREE.alerts).toBe(false)
  })

  it('PRO has unlimited saved grants', () => {
    expect(PLAN_LIMITS.PRO.maxSavedGrants).toBe(Infinity)
  })

  it('PRO has all features', () => {
    expect(PLAN_LIMITS.PRO.semanticSearch).toBe(true)
    expect(PLAN_LIMITS.PRO.alerts).toBe(true)
  })

  it('AGENCY has the same limits as PRO', () => {
    expect(PLAN_LIMITS.AGENCY.maxSavedGrants).toBe(Infinity)
    expect(PLAN_LIMITS.AGENCY.semanticSearch).toBe(true)
    expect(PLAN_LIMITS.AGENCY.alerts).toBe(true)
  })
})
