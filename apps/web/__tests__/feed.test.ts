import { describe, it, expect } from 'vitest'
import { feedQuerySchema } from '@lunchboxd/shared'
import { formatRelativeTime } from '../lib/utils'

describe('feedQuerySchema', () => {
  it('rejects invalid cursor format (non-ISO-8601 string)', () => {
    const result = feedQuerySchema.safeParse({ cursor: 'not-a-date' })
    expect(result.success).toBe(false)
  })

  it('accepts null cursor (first page, no cursor param)', () => {
    const result = feedQuerySchema.safeParse({ cursor: null })
    expect(result.success).toBe(true)
  })

  it('coerces string limit to number and enforces max 100', () => {
    const valid = feedQuerySchema.safeParse({ limit: '20' })
    expect(valid.success).toBe(true)
    if (valid.success) expect(valid.data.limit).toBe(20)

    const tooLarge = feedQuerySchema.safeParse({ limit: '200' })
    expect(tooLarge.success).toBe(false)
  })
})

describe('formatRelativeTime', () => {
  it('returns "just now" for a timestamp less than 1 minute ago', () => {
    const recent = new Date(Date.now() - 30_000).toISOString()
    expect(formatRelativeTime(recent)).toBe('just now')
  })

  it('returns "2h" for a timestamp exactly 2 hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h')
  })
})
