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
})

export const deleteGrantsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
})
