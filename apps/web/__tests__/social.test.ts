import { describe, it, expect } from 'vitest'
import { followSchema, unfollowSchema, likeSchema, userSearchSchema } from '@lunchboxd/shared'

describe('followSchema', () => {
  it('accepts valid UUID targetUserId', () => {
    const result = followSchema.safeParse({ targetUserId: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID targetUserId', () => {
    const result = followSchema.safeParse({ targetUserId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects missing targetUserId', () => {
    const result = followSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('unfollowSchema', () => {
  it('accepts valid UUID targetUserId', () => {
    const result = unfollowSchema.safeParse({ targetUserId: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID targetUserId', () => {
    const result = unfollowSchema.safeParse({ targetUserId: 'abc' })
    expect(result.success).toBe(false)
  })
})

describe('likeSchema', () => {
  it('accepts valid UUID reviewId', () => {
    const result = likeSchema.safeParse({ reviewId: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID reviewId', () => {
    const result = likeSchema.safeParse({ reviewId: 'not-valid' })
    expect(result.success).toBe(false)
  })

  it('rejects missing reviewId', () => {
    const result = likeSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('userSearchSchema', () => {
  it('accepts query with 2+ characters', () => {
    const result = userSearchSchema.safeParse({ q: 'ab' })
    expect(result.success).toBe(true)
  })

  it('rejects query shorter than 2 characters', () => {
    const result = userSearchSchema.safeParse({ q: 'a' })
    expect(result.success).toBe(false)
  })

  it('rejects empty query', () => {
    const result = userSearchSchema.safeParse({ q: '' })
    expect(result.success).toBe(false)
  })

  it('rejects query longer than 100 characters', () => {
    const result = userSearchSchema.safeParse({ q: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts query at max length (100)', () => {
    const result = userSearchSchema.safeParse({ q: 'a'.repeat(100) })
    expect(result.success).toBe(true)
  })
})
