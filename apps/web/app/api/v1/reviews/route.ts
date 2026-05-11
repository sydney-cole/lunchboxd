import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { reviews, reviewTags, restaurants, likes, userStats } from '@/lib/schema'
import { reviewSchema } from '@lunchboxd/shared'
import { resolveUserId, fanOutToFollowers } from '@/lib/queries'
import { eq, isNull, desc, and, inArray, sql } from 'drizzle-orm'

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const input = parsed.data

  // Validate photoUrl ownership: pathname must be reviews/<clerkId>/<uuid>
  if (input.photoUrl) {
    try {
      const parsed = new URL(input.photoUrl)
      const parts = parsed.pathname.split('/')
      // pathname: /<prefix>/reviews/<clerkId>/<uuid> or /reviews/<clerkId>/<uuid>
      const reviewsIdx = parts.indexOf('reviews')
      if (reviewsIdx === -1 || parts[reviewsIdx + 1] !== clerkId) {
        return NextResponse.json({ error: 'photoUrl does not belong to authenticated user' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid photoUrl' }, { status: 400 })
    }
  }

  const photoUrl = input.photoUrl ?? null

  const [review] = await db.insert(reviews).values({
    userId,
    restaurantId: input.restaurantId ?? null,
    mealType: input.mealType,
    body: input.note ?? null,
    rating: input.rating?.toString() ?? null,
    photoUrl,
    mealDate: input.mealDate ?? null,
  }).returning()

  // Insert tags (normalized: lowercase + trim)
  if (input.tags && input.tags.length > 0) {
    await db.insert(reviewTags).values(
      input.tags.map((label: string) => ({
        reviewId: review.id,
        label: label.toLowerCase().trim(),
      }))
    )
  }

  // Fan-out to followers' feeds (includes author's own feed)
  // Failure here must not mask the already-created review
  try {
    await fanOutToFollowers(review.id, userId, review.createdAt)
  } catch (err) {
    console.error('[fanOutToFollowers] failed for review', review.id, err)
  }

  // ME-09: Increment reviewCount in userStats
  try {
    await db.insert(userStats)
      .values({ userId, reviewCount: '1' })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: {
          reviewCount: sql`${userStats.reviewCount} + 1`,
          updatedAt: new Date(),
        },
      })
  } catch (err) {
    console.error('[userStats] failed to increment reviewCount for user', userId, err)
  }

  return NextResponse.json(review, { status: 201 })
}

export async function GET(_req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const userReviews = await db.select().from(reviews)
    .where(and(eq(reviews.userId, userId), isNull(reviews.deletedAt)))
    .orderBy(desc(reviews.createdAt))

  // Fetch tags for each review
  const reviewIds = userReviews.map(r => r.id)
  let tagsMap: Record<string, string[]> = {}
  if (reviewIds.length > 0) {
    const allTags = await db.select().from(reviewTags)
      .where(inArray(reviewTags.reviewId, reviewIds))
    // Group by reviewId
    for (const tag of allTags) {
      if (!tagsMap[tag.reviewId]) tagsMap[tag.reviewId] = []
      tagsMap[tag.reviewId].push(tag.label)
    }
  }

  // Fetch restaurant data for reviews with restaurantId
  const restaurantIds = userReviews
    .map(r => r.restaurantId)
    .filter((id): id is string => id !== null)
  let restaurantMap: Record<string, { name: string; address: string | null }> = {}
  if (restaurantIds.length > 0) {
    const restaurantRows = await db.select({
      id: restaurants.id,
      name: restaurants.name,
      address: restaurants.address,
    }).from(restaurants)
      .where(inArray(restaurants.id, restaurantIds))
    for (const r of restaurantRows) {
      restaurantMap[r.id] = { name: r.name, address: r.address ?? null }
    }
  }

  // Fetch like data for all reviews (batch — not N+1)
  let likeCountMap: Record<string, number> = {}
  let likedByMeSet = new Set<string>()
  if (reviewIds.length > 0) {
    const likeRows = await db
      .select({ reviewId: likes.reviewId, likeUserId: likes.userId })
      .from(likes)
      .where(inArray(likes.reviewId, reviewIds))

    for (const row of likeRows) {
      likeCountMap[row.reviewId] = (likeCountMap[row.reviewId] ?? 0) + 1
      if (row.likeUserId === userId) likedByMeSet.add(row.reviewId)
    }
  }

  const result = userReviews.map(r => ({
    ...r,
    tags: tagsMap[r.id] ?? [],
    restaurant: r.restaurantId ? (restaurantMap[r.restaurantId] ?? null) : null,
    likeCount: likeCountMap[r.id] ?? 0,
    isLikedByMe: likedByMeSet.has(r.id),
  }))

  return NextResponse.json(result)
}
