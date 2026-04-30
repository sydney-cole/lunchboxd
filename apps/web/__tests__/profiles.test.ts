import { describe, it, expect } from 'vitest'
import { patchUserSchema, profileQuerySchema } from '@lunchboxd/shared'

describe('patchUserSchema', () => {
  it('rejects bio longer than 500 characters', () => {
    const result = patchUserSchema.safeParse({ bio: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('accepts bio of exactly 500 characters', () => {
    const result = patchUserSchema.safeParse({ bio: 'a'.repeat(500) })
    expect(result.success).toBe(true)
  })

  it('rejects displayName longer than 50 characters', () => {
    const result = patchUserSchema.safeParse({ displayName: 'a'.repeat(51) })
    expect(result.success).toBe(false)
  })

  it('accepts partial updates — bio only', () => {
    const result = patchUserSchema.safeParse({ bio: 'My bio' })
    expect(result.success).toBe(true)
  })

  it('accepts partial updates — avatarKey only', () => {
    const result = patchUserSchema.safeParse({
      avatarKey: 'avatars/user_clerk_123/550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts partial updates — all fields', () => {
    const result = patchUserSchema.safeParse({
      bio: 'Hello world',
      displayName: 'Jane Doe',
      avatarKey: 'avatars/user_clerk_123/550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    const result = patchUserSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects malformed avatarKey (path traversal attempt)', () => {
    const result = patchUserSchema.safeParse({ avatarKey: '../../etc/passwd' })
    expect(result.success).toBe(false)
  })
})

describe('profileQuerySchema', () => {
  it('accepts null cursor (first page)', () => {
    const result = profileQuerySchema.safeParse({ cursor: null })
    expect(result.success).toBe(true)
  })

  it('rejects non-ISO-8601 cursor string', () => {
    const result = profileQuerySchema.safeParse({ cursor: 'not-a-date' })
    expect(result.success).toBe(false)
  })

  it('accepts valid ISO 8601 cursor', () => {
    const result = profileQuerySchema.safeParse({ cursor: '2026-04-30T12:00:00.000Z' })
    expect(result.success).toBe(true)
  })

  it('coerces string limit to number', () => {
    const result = profileQuerySchema.safeParse({ limit: '20' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(20)
  })

  it('rejects limit greater than 100', () => {
    const result = profileQuerySchema.safeParse({ limit: '200' })
    expect(result.success).toBe(false)
  })
})
