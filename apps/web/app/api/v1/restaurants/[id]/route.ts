import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { restaurants, reviews, reviewTags, likes, users } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { eq, isNull, desc, and, inArray, sql } from 'drizzle-orm'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const viewerUserId = await resolveUserId(clerkId)

  const sort = req.nextUrl.searchParams.get('sort') ?? 'recent'

  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, id))

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  const orderBy =
    sort === 'high'
      ? [sql`${reviews.rating}::numeric DESC NULLS LAST`, desc(reviews.createdAt)]
      : sort === 'low'
      ? [sql`${reviews.rating}::numeric ASC NULLS LAST`, desc(reviews.createdAt)]
      : [desc(reviews.createdAt)]

  const reviewRows = await db
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
    })
    .from(reviews)
    .where(and(eq(reviews.restaurantId, id), isNull(reviews.deletedAt)))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .orderBy(...(orderBy as any))

  if (reviewRows.length === 0) {
    return NextResponse.json({
      restaurant,
      reviews: [],
      avgRating: null,
      reviewCount: 0,
    })
  }

  const reviewIds = reviewRows.map((r) => r.id)
  const userIds = [...new Set(reviewRows.map((r) => r.userId))]

  const [tags, authors, allLikes] = await Promise.all([
    db
      .select({ reviewId: reviewTags.reviewId, label: reviewTags.label })
      .from(reviewTags)
      .where(inArray(reviewTags.reviewId, reviewIds)),
    db
      .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, userIds)),
    db
      .select({ reviewId: likes.reviewId, userId: likes.userId })
      .from(likes)
      .where(inArray(likes.reviewId, reviewIds)),
  ])

  const tagMap = new Map<string, string[]>()
  for (const t of tags) {
    const arr = tagMap.get(t.reviewId) ?? []
    arr.push(t.label)
    tagMap.set(t.reviewId, arr)
  }

  const authorMap = new Map(authors.map((u) => [u.id, u]))

  const likeCountMap = new Map<string, number>()
  const likedByMeSet = new Set<string>()
  for (const l of allLikes) {
    likeCountMap.set(l.reviewId, (likeCountMap.get(l.reviewId) ?? 0) + 1)
    if (viewerUserId && l.userId === viewerUserId) likedByMeSet.add(l.reviewId)
  }

  const ratings = reviewRows
    .map((r) => (r.rating ? parseFloat(r.rating) : null))
    .filter((v): v is number => v !== null)
  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null

  const enriched = reviewRows.map((r) => ({
    id: r.id,
    mealName: r.mealName,
    body: r.body,
    rating: r.rating,
    photoUrl: r.photoUrl,
    mealType: r.mealType,
    mealDate: r.mealDate,
    createdAt: r.createdAt,
    tags: tagMap.get(r.id) ?? [],
    likeCount: likeCountMap.get(r.id) ?? 0,
    isLikedByMe: likedByMeSet.has(r.id),
    isOwnReview: r.userId === (viewerUserId ?? ''),
    author: authorMap.get(r.userId) ?? null,
  }))

  return NextResponse.json({
    restaurant,
    reviews: enriched,
    avgRating,
    reviewCount: reviewRows.length,
  })
}
