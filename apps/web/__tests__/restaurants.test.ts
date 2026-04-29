import { describe, it, expect } from 'vitest'
import { restaurantSearchSchema, reviewSchema } from '@lunchboxd/shared'

describe('MEAL-01: Restaurant search autocomplete', () => {
  it('should require search query minimum 2 characters', () => {
    const result = restaurantSearchSchema.safeParse({ q: 'a' })
    expect(result.success).toBe(false)
  })
  it('should accept search query of 2+ characters', () => {
    const result = restaurantSearchSchema.safeParse({ q: 'ta' })
    expect(result.success).toBe(true)
  })
})

describe('MEAL-02: Manual restaurant entry', () => {
  it.todo('Manual entry creates restaurant row with source: manual and placeId: null')
})

describe('MEAL-03: Homemade meal tag', () => {
  it('should accept mealType homemade with no restaurantId', () => {
    const result = reviewSchema.safeParse({ mealType: 'homemade', restaurantId: null })
    expect(result.success).toBe(true)
  })
})
