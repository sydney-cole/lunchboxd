import { describe, it, expect } from 'vitest'
import { notificationQuerySchema, restaurantReviewedQuerySchema } from '@lunchboxd/shared'

// Pure function representing D-02 self-notification skip logic
function shouldSkipNotification(actorId: string, userId: string): boolean {
  return actorId === userId
}

// Pure function representing reviewedByFollowed computation
function computeReviewedByFollowed(followingSet: Set<string>, reviewerIds: string[]): boolean {
  return reviewerIds.some(id => followingSet.has(id))
}

describe('notificationQuerySchema', () => {
  it('accepts valid ISO 8601 cursor', () => {
    const result = notificationQuerySchema.safeParse({ cursor: '2026-05-01T00:00:00.000Z' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid cursor (non-ISO-8601 string)', () => {
    const result = notificationQuerySchema.safeParse({ cursor: 'not-a-date' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.length).toBeGreaterThan(0)
  })

  it('coerces string limit to number', () => {
    const result = notificationQuerySchema.safeParse({ limit: '10' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(10)
  })

  it('defaults limit to 20 when no input provided', () => {
    const result = notificationQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(20)
  })

  it('rejects limit of 0 (min is 1)', () => {
    const result = notificationQuerySchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })

  it('accepts null cursor (first page)', () => {
    const result = notificationQuerySchema.safeParse({ cursor: null })
    expect(result.success).toBe(true)
  })

  it('coerces string limit with valid cursor', () => {
    const result = notificationQuerySchema.safeParse({ cursor: '2026-05-01T00:00:00.000Z', limit: '20' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(20)
  })
})

describe('restaurantReviewedQuerySchema', () => {
  it('accepts a valid q string', () => {
    const result = restaurantReviewedQuerySchema.safeParse({ q: 'Brooklyn' })
    expect(result.success).toBe(true)
  })

  it('rejects q that exceeds 100 characters', () => {
    const result = restaurantReviewedQuerySchema.safeParse({ q: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts omitted q (optional field)', () => {
    const result = restaurantReviewedQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts q at the boundary of exactly 100 characters', () => {
    const result = restaurantReviewedQuerySchema.safeParse({ q: 'a'.repeat(100) })
    expect(result.success).toBe(true)
  })
})

describe('shouldSkipNotification', () => {
  it('returns true when actorId equals userId (self-notification skip)', () => {
    expect(shouldSkipNotification('user-123', 'user-123')).toBe(true)
  })

  it('returns false when actorId differs from userId', () => {
    expect(shouldSkipNotification('user-123', 'user-456')).toBe(false)
  })
})

describe('computeReviewedByFollowed', () => {
  it('returns true when a reviewer is in the following set', () => {
    const followingSet = new Set(['user-1', 'user-2', 'user-3'])
    const reviewerIds = ['user-5', 'user-2']
    expect(computeReviewedByFollowed(followingSet, reviewerIds)).toBe(true)
  })

  it('returns false when no reviewer is in the following set', () => {
    const followingSet = new Set(['user-1', 'user-2'])
    const reviewerIds = ['user-5', 'user-6']
    expect(computeReviewedByFollowed(followingSet, reviewerIds)).toBe(false)
  })

  it('returns false for an empty reviewer list', () => {
    const followingSet = new Set(['user-1'])
    expect(computeReviewedByFollowed(followingSet, [])).toBe(false)
  })

  it('returns false for an empty following set', () => {
    const followingSet = new Set<string>()
    expect(computeReviewedByFollowed(followingSet, ['user-1'])).toBe(false)
  })
})
