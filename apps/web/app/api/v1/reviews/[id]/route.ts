import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { reviews, reviewTags, feedItems, restaurants, userStats } from '@/lib/schema'
import { reviewSchema, updateReviewSchema } from '@lunchboxd/shared'
import { resolveUserId } from '@/lib/queries'
import { eq, and, isNull, sql } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // CR-07: Remove userId filter from GET — any authenticated user can fetch a review by ID.
  // Ownership check is kept for PATCH and DELETE handlers only.
  const [review] = await db.select().from(reviews)
    .where(and(eq(reviews.id, id), isNull(reviews.deletedAt)))

  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const tags = await db.select({ label: reviewTags.label }).from(reviewTags)
    .where(eq(reviewTags.reviewId, id))

  let restaurant = null
  if (review.restaurantId) {
    const [r] = await db.select({ name: restaurants.name, address: restaurants.address })
      .from(restaurants)
      .where(eq(restaurants.id, review.restaurantId))
    restaurant = r ?? null
  }

  return NextResponse.json({
    ...review,
    tags: tags.map(t => t.label),
    restaurant,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params   // Next.js 16: params is a Promise
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Check ownership
  const [existing] = await db.select({ userId: reviews.userId })
    .from(reviews)
    .where(and(eq(reviews.id, id), isNull(reviews.deletedAt)))

  if (!existing) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  if (existing.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = updateReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const input = parsed.data

  // Validate photoUrl ownership: pathname must be reviews/<clerkId>/<uuid>
  if (input.photoUrl) {
    try {
      const parsed = new URL(input.photoUrl)
      const parts = parsed.pathname.split('/')
      const reviewsIdx = parts.indexOf('reviews')
      if (reviewsIdx === -1 || parts[reviewsIdx + 1] !== clerkId) {
        return NextResponse.json({ error: 'photoUrl does not belong to authenticated user' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid photoUrl' }, { status: 400 })
    }
  }

  // Build update set — only include fields that were provided
  const updateSet: Record<string, unknown> = { updatedAt: new Date() }
  if (input.mealType !== undefined) updateSet.mealType = input.mealType
  if (input.restaurantId !== undefined) updateSet.restaurantId = input.restaurantId ?? null
  if (input.note !== undefined) updateSet.body = input.note ?? null
  if (input.rating !== undefined) updateSet.rating = input.rating?.toString() ?? null
  if (input.photoUrl !== undefined) {
    updateSet.photoUrl = input.photoUrl ?? null
  }
  if (input.mealDate !== undefined) updateSet.mealDate = input.mealDate ?? null

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(reviews)
      .set(updateSet)
      .where(eq(reviews.id, id))
      .returning()

    // Replace tags atomically within the same transaction
    if (input.tags !== undefined) {
      await tx.delete(reviewTags).where(eq(reviewTags.reviewId, id))
      if (input.tags.length > 0) {
        await tx.insert(reviewTags).values(
          input.tags.map((label: string) => ({
            reviewId: id,
            label: label.toLowerCase().trim(),
          }))
        )
      }
    }

    return row
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params   // Next.js 16: params is a Promise
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Check ownership
  const [existing] = await db.select({ userId: reviews.userId })
    .from(reviews)
    .where(and(eq(reviews.id, id), isNull(reviews.deletedAt)))

  if (!existing) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  if (existing.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Soft-delete the review
  await db.update(reviews)
    .set({ deletedAt: new Date() })
    .where(eq(reviews.id, id))

  // Hard-delete feed_items for this review (denormalized cache rows)
  await db.delete(feedItems).where(eq(feedItems.reviewId, id))

  // ME-09: Decrement reviewCount in userStats (floor at 0)
  await db.insert(userStats)
    .values({ userId, reviewCount: '0' })
    .onConflictDoUpdate({
      target: userStats.userId,
      set: {
        reviewCount: sql`GREATEST(${userStats.reviewCount} - 1, 0)`,
        updatedAt: new Date(),
      },
    })

  return NextResponse.json({ success: true })
}
