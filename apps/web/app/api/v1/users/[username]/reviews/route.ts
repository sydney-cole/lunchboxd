import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, reviews, reviewTags, likes, restaurants } from '@/lib/schema'
import { profileQuerySchema } from '@lunchboxd/shared'
import { eq, and, isNull, lt, desc, inArray } from 'drizzle-orm'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params

  // Auth optional — unauthenticated viewers see reviews without isLikedByMe
  const { userId: clerkId } = await auth()

  // Parse cursor and limit from query string
  const { searchParams } = new URL(req.url)
  const parsed = profileQuerySchema.safeParse({
    cursor: searchParams.get('cursor'),
    limit: searchParams.get('limit') ?? 20,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query params' }, { status: 400 })
  }
  const { cursor, limit } = parsed.data

  // Resolve profile user
  const [profileUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))

  if (!profileUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Build WHERE: userId match + soft-delete filter + optional cursor
  const conditions = [
    eq(reviews.userId, profileUser.id),
    isNull(reviews.deletedAt),
    ...(cursor ? [lt(reviews.createdAt, new Date(cursor))] : []),
  ]

  // limit+1 trick: fetch one extra to detect hasMore without COUNT query
  const fetchLimit = limit + 1
  const rows = await db
    .select({
      id: reviews.id,
      body: reviews.body,
      rating: reviews.rating,
      photoUrl: reviews.photoUrl,
      mealType: reviews.mealType,
      mealDate: reviews.mealDate,
      createdAt: reviews.createdAt,
      restaurantId: reviews.restaurantId,
    })
    .from(reviews)
    .where(and(...conditions))
    .orderBy(desc(reviews.createdAt))
    .limit(fetchLimit)

  const hasMore = rows.length === fetchLimit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null

  if (items.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null })
  }

  const reviewIds = items.map(r => r.id)
  const restaurantIds = items.map(r => r.restaurantId).filter(Boolean) as string[]

  // Batch tags
  const tags = await db
    .select({ reviewId: reviewTags.reviewId, label: reviewTags.label })
    .from(reviewTags)
    .where(inArray(reviewTags.reviewId, reviewIds))

  // Batch restaurants
  const restaurantRows = restaurantIds.length > 0
    ? await db
        .select({ id: restaurants.id, name: restaurants.name, address: restaurants.address })
        .from(restaurants)
        .where(inArray(restaurants.id, restaurantIds))
    : []

  // Batch likes
  const allLikes = await db
    .select({ reviewId: likes.reviewId, userId: likes.userId })
    .from(likes)
    .where(inArray(likes.reviewId, reviewIds))

  // Resolve viewer for isLikedByMe
  let viewerUserId: string | null = null
  if (clerkId) {
    const [viewer] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId))
    viewerUserId = viewer?.id ?? null
  }

  // Build lookup maps
  const tagMap = new Map<string, string[]>()
  for (const t of tags) {
    const arr = tagMap.get(t.reviewId) ?? []
    arr.push(t.label)
    tagMap.set(t.reviewId, arr)
  }

  const restaurantMap = new Map(restaurantRows.map(r => [r.id, r]))

  const likeCountMap = new Map<string, number>()
  const likedByMeSet = new Set<string>()
  for (const l of allLikes) {
    likeCountMap.set(l.reviewId, (likeCountMap.get(l.reviewId) ?? 0) + 1)
    if (viewerUserId && l.userId === viewerUserId) likedByMeSet.add(l.reviewId)
  }

  const enriched = items.map(r => ({
    id: r.id,
    body: r.body,
    rating: r.rating,
    photoUrl: r.photoUrl,
    mealType: r.mealType,
    mealDate: r.mealDate,
    createdAt: r.createdAt,
    tags: tagMap.get(r.id) ?? [],
    restaurant: r.restaurantId ? (restaurantMap.get(r.restaurantId) ?? null) : null,
    likeCount: likeCountMap.get(r.id) ?? 0,
    isLikedByMe: likedByMeSet.has(r.id),
  }))

  return NextResponse.json({ items: enriched, nextCursor })
}
