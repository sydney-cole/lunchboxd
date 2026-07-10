import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, reviews, reviewTags, likes, restaurants } from '@/lib/schema'
import { profileQuerySchema } from '@lunchboxd/shared'
import { eq, and, isNull, lt, desc, inArray } from 'drizzle-orm'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ label: string }> }
) {
  // Next.js 16: params is a Promise. Tags are stored lowercased/trimmed.
  const { label: rawLabel } = await params
  const label = decodeURIComponent(rawLabel).trim().toLowerCase()

  // Auth is optional — tag pages are public browse. Viewers just miss isLikedByMe.
  const { userId: clerkId } = await auth()

  const { searchParams } = new URL(req.url)
  const parsed = profileQuerySchema.safeParse({
    cursor: searchParams.get('cursor'),
    limit: searchParams.get('limit') ?? 20,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query params' }, { status: 400 })
  }
  const { cursor, limit } = parsed.data

  // Filter on the tag label; order + paginate on reviews.createdAt.
  const conditions = [
    eq(reviewTags.label, label),
    isNull(reviews.deletedAt),
    ...(cursor ? [lt(reviews.createdAt, new Date(cursor))] : []),
  ]

  // limit+1 to detect hasMore without a COUNT query
  const fetchLimit = limit + 1
  const rows = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      mealName: reviews.mealName,
      body: reviews.body,
      rating: reviews.rating,
      photoUrl: reviews.photoUrl,
      mealType: reviews.mealType,
      mealDate: reviews.mealDate,
      createdAt: reviews.createdAt,
      restaurantId: reviews.restaurantId,
    })
    .from(reviewTags)
    .innerJoin(reviews, eq(reviews.id, reviewTags.reviewId))
    .where(and(...conditions))
    .orderBy(desc(reviews.createdAt))
    .limit(fetchLimit)

  // Dedup by review id — a duplicate tag row would otherwise double-count and
  // corrupt the limit+1 / cursor math.
  const seen = new Set<string>()
  const deduped = rows.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)))

  const hasMore = deduped.length > limit
  const items = hasMore ? deduped.slice(0, limit) : deduped
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null

  if (items.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null })
  }

  const reviewIds = items.map(r => r.id)
  const restaurantIds = items.map(r => r.restaurantId).filter(Boolean) as string[]
  const authorIds = [...new Set(items.map(r => r.userId))]

  // Batch-fetch enrichment data (no N+1)
  const [tags, restaurantRows, allLikes, authorRows] = await Promise.all([
    db
      .select({ reviewId: reviewTags.reviewId, label: reviewTags.label })
      .from(reviewTags)
      .where(inArray(reviewTags.reviewId, reviewIds)),
    restaurantIds.length > 0
      ? db
          .select({ id: restaurants.id, name: restaurants.name, address: restaurants.address })
          .from(restaurants)
          .where(inArray(restaurants.id, restaurantIds))
      : Promise.resolve([]),
    db
      .select({ reviewId: likes.reviewId, userId: likes.userId })
      .from(likes)
      .where(inArray(likes.reviewId, reviewIds)),
    db
      .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, authorIds)),
  ])

  // Resolve viewer for isLikedByMe / isOwnReview
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
  const authorMap = new Map(authorRows.map(u => [u.id, u]))

  const likeCountMap = new Map<string, number>()
  const likedByMeSet = new Set<string>()
  for (const l of allLikes) {
    likeCountMap.set(l.reviewId, (likeCountMap.get(l.reviewId) ?? 0) + 1)
    if (viewerUserId && l.userId === viewerUserId) likedByMeSet.add(l.reviewId)
  }

  const enriched = items.map(r => ({
    id: r.id,
    mealName: r.mealName,
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
    isOwnReview: viewerUserId != null && r.userId === viewerUserId,
    author: authorMap.get(r.userId) ?? null,
  }))

  return NextResponse.json({ items: enriched, nextCursor })
}
