import { z } from 'zod/v4'

export const signUpSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  username: z.string()
    .min(1, 'This field is required.')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.'),
})

export const signInSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'This field is required.'),
})

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address.'),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const reviewSchema = z.object({
  mealType: z.enum(['restaurant', 'homemade']),
  restaurantId: z.string().uuid().optional().nullable(),
  rating: z.number().min(0.5).max(5).multipleOf(0.5),
  note: z.string().max(2000).optional(),
  photoKey: z.string().optional().nullable(),
  tags: z.array(z.string().max(50)).max(50).default([]),
  mealDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

// For PATCH: all fields optional (rating not required for partial updates)
export const updateReviewSchema = reviewSchema.partial()

export type CreateReviewInput = z.infer<typeof reviewSchema>
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>

export const restaurantSearchSchema = z.object({
  q: z.string().min(2),
})

export type RestaurantSearchInput = z.infer<typeof restaurantSearchSchema>

// --- Phase 3: Social Graph schemas ---

export const followSchema = z.object({
  targetUserId: z.string().uuid(),
})
export type FollowInput = z.infer<typeof followSchema>

export const unfollowSchema = z.object({
  targetUserId: z.string().uuid(),
})
export type UnfollowInput = z.infer<typeof unfollowSchema>

export const likeSchema = z.object({
  reviewId: z.string().uuid(),
})
export type LikeInput = z.infer<typeof likeSchema>

export const userSearchSchema = z.object({
  q: z.string().min(2).max(100),
})
export type UserSearchInput = z.infer<typeof userSearchSchema>

// --- Phase 4: Feed schemas ---

export const feedQuerySchema = z.object({
  cursor: z.string().datetime().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type FeedQueryInput = z.infer<typeof feedQuerySchema>

// --- Phase 5: Profiles schemas ---

export const patchUserSchema = z.object({
  bio: z.string().max(500).optional(),
  displayName: z.string().max(50).optional(),
  // R2 key returned by POST /api/v1/uploads; server constructs the public URL
  // Pattern: avatars/<clerkId>/<uuid> — only avatars/ prefix allowed for profile photos
  avatarKey: z.string().regex(/^avatars\/[a-zA-Z0-9_-]+\/[0-9a-f-]{36}$/).optional(),
})
export type PatchUserInput = z.infer<typeof patchUserSchema>

export const profileQuerySchema = z.object({
  cursor: z.string().datetime().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type ProfileQueryInput = z.infer<typeof profileQuerySchema>

export const followListQuerySchema = z.object({
  cursor: z.string().uuid().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type FollowListQueryInput = z.infer<typeof followListQuerySchema>
