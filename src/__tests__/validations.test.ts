import { describe, it, expect } from 'vitest'
import { saveGrantSchema, searchGrantsSchema, deleteGrantsSchema } from '@/lib/validations'

describe('saveGrantSchema', () => {
  it('accepts a valid id string', () => {
    const result = saveGrantSchema.safeParse({ grantId: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  it('accepts a cuid-style id', () => {
    const result = saveGrantSchema.safeParse({ grantId: 'clxxxxxxxxxxxxxxxxxxxxx' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty id', () => {
    const result = saveGrantSchema.safeParse({ grantId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing grantId', () => {
    const result = saveGrantSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects an id over 100 chars', () => {
    const result = saveGrantSchema.safeParse({ grantId: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

describe('searchGrantsSchema', () => {
  it('accepts valid query', () => {
    const result = searchGrantsSchema.safeParse({ query: 'palyazat' })
    expect(result.success).toBe(true)
  })

  it('rejects empty query', () => {
    const result = searchGrantsSchema.safeParse({ query: '' })
    expect(result.success).toBe(false)
  })

  it('rejects query over 500 chars', () => {
    const result = searchGrantsSchema.safeParse({ query: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('uses defaults for page and pageSize', () => {
    const result = searchGrantsSchema.safeParse({ query: 'test' })
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(20)
    }
  })

  it('coerces string page numbers', () => {
    const result = searchGrantsSchema.safeParse({ query: 'test', page: '3', pageSize: '10' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.pageSize).toBe(10)
    }
  })

  it('rejects page below 1', () => {
    const result = searchGrantsSchema.safeParse({ query: 'test', page: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects pageSize over 50', () => {
    const result = searchGrantsSchema.safeParse({ query: 'test', pageSize: 51 })
    expect(result.success).toBe(false)
  })
})

describe('deleteGrantsSchema', () => {
  it('accepts valid ids array', () => {
    const result = deleteGrantsSchema.safeParse({ ids: ['550e8400-e29b-41d4-a716-446655440000'] })
    expect(result.success).toBe(true)
  })

  it('rejects empty array', () => {
    const result = deleteGrantsSchema.safeParse({ ids: [] })
    expect(result.success).toBe(false)
  })

  it('rejects over 100 ids', () => {
    const result = deleteGrantsSchema.safeParse({
      ids: Array(101).fill('550e8400-e29b-41d4-a716-446655440000'),
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty-string ids in the array', () => {
    const result = deleteGrantsSchema.safeParse({ ids: [''] })
    expect(result.success).toBe(false)
  })
})
