import { z } from 'zod'

export const saveGrantSchema = z.object({
  grantId: z.string().min(1).max(100),
})

export const searchGrantsSchema = z.object({
  query: z.string().min(1).max(500),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
  companyName: z.string().max(200).optional(),
  taxNumber: z.string().max(50).optional(),
  companySizePref: z.array(z.enum(['MICRO', 'SMALL', 'MEDIUM'])).optional(),
  sectorPrefs: z.array(z.string().max(100)).optional(),
  regions: z.array(z.string().max(120)).optional(),
  legalForm: z.enum(['KFT_ZRT', 'EV', 'OSTERMELO', 'SZOVETKEZET', 'EGYEB', '']).optional(),
  closedFiscalYears: z.number().int().min(0).max(100).nullable().optional(),
  headcount: z.number().int().min(0).max(100000).nullable().optional(),
  annualRevenueM: z.number().min(0).max(1000000).nullable().optional(),
  positiveEquity: z.enum(['YES', 'NO', 'UNKNOWN']).optional(),
  noTaxDebt: z.enum(['YES', 'NO', 'UNKNOWN']).optional(),
  locationRight: z.enum(['OWNED', 'RENTED', 'PLANNED', 'UNKNOWN']).optional(),
  ownContributionPct: z.number().min(0).max(100).nullable().optional(),
  deMinimisUsedEur: z.number().min(0).max(10000000).nullable().optional(),
  isAgriProducer: z.boolean().optional(),
  hasKnyr: z.enum(['YES', 'NO', 'UNKNOWN']).optional(),
  steValue: z.number().min(0).max(100000000).nullable().optional(),
  agriRevenuePct: z.number().min(0).max(100).nullable().optional(),
  hasUnifiedApplication: z.enum(['YES', 'NO', 'UNKNOWN']).optional(),
})

export const updateSavedGrantChecklistSchema = z.object({
  grantId: z.string().min(1).max(100),
  checkedDocs: z.array(z.string().max(100)).max(50),
  notes: z.string().max(5000).optional(),
})

export const deleteGrantsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
})
