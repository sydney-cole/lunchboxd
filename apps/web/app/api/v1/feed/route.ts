import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { feedItems, reviews, users, restaurants, likes, reviewTags } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { feedQuerySchema } from '@lunchboxd/shared'
import { eq, lt, and, isNull, desc, inArray } from 'drizzle-orm'

export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const parsed = feedQuerySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query params', issues: parsed.error.issues }, { status: 400 })
  }
  const { cursor, limit } = parsed.data
  const PAGE_SIZE = limit ?? 20

  // Build WHERE clause: owner = me AND (if cursor) createdAt < cursor
  // CRITICAL: pass new Date(cursor) to lt() — not raw string — for timestamp comparison
  const whereClause = cursor
    ? and(
        eq(feedItems.ownerUserId, userId),
        lt(feedItems.createdAt, new Date(cursor))
      )
    : eq(feedItems.ownerUserId, userId)

  // Fetch PAGE_SIZE + 1 rows to detect hasMore without a COUNT query
  const rawRows = await db
    .select({ reviewId: feedItems.reviewId, feedCreatedAt: feedItems.createdAt })
    .from(feedItems)
    .where(whereClause)
    .orderBy(desc(feedItems.createdAt))
    .limit(PAGE_SIZE + 1)

  const hasMore = rawRows.length > PAGE_SIZE
  const pageRows = rawRows.slice(0, PAGE_SIZE)
  const nextCursor = hasMore
    ? pageRows[pageRows.length - 1].feedCreatedAt.toISOString()
    : null

  if (pageRows.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null })
  }

  const reviewIds = pageRows.map(r => r.reviewId)

  // Batch-fetch all related data — no N+1 queries
  const [reviewRows, tagRows, likeRows] = await Promise.all([
    db.select().from(reviews).where(
      and(inArray(reviews.id, reviewIds), isNull(reviews.deletedAt))
    ),
    db.select().from(reviewTags).where(inArray(reviewTags.reviewId, reviewIds)),
    db.select({ reviewId: likes.reviewId, likeUserId: likes.userId })
      .from(likes)
      .where(inArray(likes.reviewId, reviewIds)),
  ])

  const restaurantIds = reviewRows
    .map(r => r.restaurantId)
    .filter((id): id is string => id !== null)
  const authorIds = [...new Set(reviewRows.map(r => r.userId))]

  const [restaurantRows, authorRows] = await Promise.all([
    restaurantIds.length > 0
      ? db
          .select({ id: restaurants.id, name: restaurants.name, address: restaurants.address })
          .from(restaurants)
          .where(inArray(restaurants.id, restaurantIds))
      : Promise.resolve([]),
    db
      .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, authorIds)),
  ])

  // Build lookup maps
  const reviewMap = Object.fromEntries(reviewRows.map(r => [r.id, r]))

  const tagsMap: Record<string, string[]> = {}
  for (const tag of tagRows) {
    if (!tagsMap[tag.reviewId]) tagsMap[tag.reviewId] = []
    tagsMap[tag.reviewId].push(tag.label)
  }

  const likeCountMap: Record<string, number> = {}
  const likedByMeSet = new Set<string>()
  for (const row of likeRows) {
    likeCountMap[row.reviewId] = (likeCountMap[row.reviewId] ?? 0) + 1
    if (row.likeUserId === userId) likedByMeSet.add(row.reviewId)
  }

  const restaurantMap = Object.fromEntries(restaurantRows.map(r => [r.id, r]))
  const authorMap = Object.fromEntries(authorRows.map(u => [u.id, u]))

  // Shape items in feedItems.createdAt DESC order (pageRows preserves this order)
  const items = pageRows
    .map(row => {
      const review = reviewMap[row.reviewId]
      if (!review) return null
      return {
        id: review.id,
        body: review.body,
        rating: review.rating,
        photoUrl: review.photoUrl,
        mealType: review.mealType,
        mealDate: review.mealDate,
        createdAt: review.createdAt,
        feedCreatedAt: row.feedCreatedAt.toISOString(),
        tags: tagsMap[review.id] ?? [],
        restaurant: review.restaurantId
          ? (restaurantMap[review.restaurantId] ?? null)
          : null,
        likeCount: likeCountMap[review.id] ?? 0,
        isLikedByMe: likedByMeSet.has(review.id),
        author: authorMap[review.userId] ?? null,
        isOwnReview: review.userId === userId,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ items, nextCursor })
}
