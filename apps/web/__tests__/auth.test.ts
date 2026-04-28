import { describe, it, expect } from 'vitest'

describe('AUTH-01: Email/password sign-up', () => {
  it.todo('should validate sign-up input with Zod schema')
  it.todo('should reject invalid email format')
  it.todo('should reject password shorter than 8 characters')
  it.todo('should reject invalid username characters')
})

describe('AUTH-02: Persistent sessions', () => {
  it.todo('should have Clerk middleware configured')
  it.todo('should protect non-public routes')
})

describe('AUTH-03: Google OAuth', () => {
  it.todo('should have Google OAuth button on sign-up page')
  it.todo('should have Google OAuth button on sign-in page')
})

describe('AUTH-04: Password reset', () => {
  it.todo('should validate forgot-password email input')
})

// Smoke test to confirm vitest runs
describe('Shared package imports', () => {
  it('should export signUpSchema from shared package', async () => {
    const { signUpSchema } = await import('@lunchboxd/shared')
    expect(signUpSchema).toBeDefined()
  })

  it('should export colors from shared package', async () => {
    const { colors } = await import('@lunchboxd/shared')
    expect(colors.accent).toBe('#F97316')
  })
})
