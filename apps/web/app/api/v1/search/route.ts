import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, follows, friendships, reviews, restaurants, reviewTags, likes } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { eq, and, or, ilike, inArray, isNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod/v4'

const searchSchema = z.object({
  q: z.string().min(2).max(100),
})

type ReviewResult = {
  id: string
  mealName: string | null
  body: string | null
  rating: string | null
  photoUrl: string | null
  mealType: string
  mealDate: string | null
  createdAt: string
  tags: string[]
  restaurant: { id: string; name: string; address: string | null } | null
  likeCount: number
  isLikedByMe: boolean
  isOwnReview: boolean
  isFriend: boolean
  author: { id: string; username: string; avatarUrl: string | null } | null
}

export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actorUserId = await resolveUserId(clerkId)
  if (!actorUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const parsed = searchSchema.safeParse({ q: searchParams.get('q') ?? '' })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Query must be 2-100 characters' }, { status: 400 })
  }

  const q = parsed.data.q
  const term = `%${q}%`

  // Fetch following + friendship sets for priority sorting
  const [followingRows, friendshipRows] = await Promise.all([
    db.select({ followeeId: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, actorUserId)),
    db.select({ userAId: friendships.userAId, userBId: friendships.userBId })
      .from(friendships)
      .where(
        or(
          eq(friendships.userAId, actorUserId),
          eq(friendships.userBId, actorUserId)
        )
      ),
  ])

  const followingSet = new Set(followingRows.map(f => f.followeeId))
  const friendSet = new Set([
    ...friendshipRows.filter(f => f.userAId === actorUserId).map(f => f.userBId),
    ...friendshipRows.filter(f => f.userBId === actorUserId).map(f => f.userAId),
  ])

  // Parallel search across all categories
  const [userRows, mealRows, restaurantRows, tagRows] = await Promise.all([
    // Users: match username or displayName
    db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(and(
        or(ilike(users.username, term), ilike(users.displayName, term)),
        ne(users.id, actorUserId)
      ))
      .limit(20),

    // Meals: match mealName or body
    db.select()
      .from(reviews)
      .where(and(
        isNull(reviews.deletedAt),
        or(ilike(reviews.mealName, term), ilike(reviews.body, term))
      ))
      .limit(50),

    // Restaurants: match name
    db.select({ id: restaurants.id, name: restaurants.name, address: restaurants.address, city: restaurants.city })
      .from(restaurants)
      .where(ilike(restaurants.name, term))
      .limit(20),

    // Tags: find review IDs with matching tag labels
    db.select({ reviewId: reviewTags.reviewId, label: reviewTags.label })
      .from(reviewTags)
      .where(ilike(reviewTags.label, term))
      .limit(200),
  ])

  // Augment restaurant results with Places API when local cache is thin
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (apiKey && restaurantRows.length < 5) {
    try {
      const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
        },
        body: JSON.stringify({ textQuery: q, includedType: 'restaurant' }),
      })
      if (placesRes.ok) {
        const { places = [] } = await placesRes.json()
        const upserted = await Promise.all(
          places.slice(0, 5).map(async (p: any) => {
            const [row] = await db.insert(restaurants).values({
              placeId: p.id,
              source: 'google_places',
              name: p.displayName?.text ?? '',
              address: p.formattedAddress ?? null,
              lat: p.location?.latitude?.toString() ?? null,
              lng: p.location?.longitude?.toString() ?? null,
            })
            .onConflictDoUpdate({
              target: restaurants.placeId,
              targetWhere: sql`place_id IS NOT NULL`,
              set: {
                name: p.displayName?.text ?? '',
                address: p.formattedAddress ?? null,
              },
            })
            .returning()
            return row
          })
        )
        const existingIds = new Set(restaurantRows.map(r => r.id))
        for (const row of upserted) {
          if (row && !existingIds.has(row.id)) {
            restaurantRows.push({ id: row.id, name: row.name, address: row.address, city: row.city ?? null })
          }
        }
      }
    } catch {
      // Places API failure is non-fatal — local results still returned
    }
  }

  // Fetch reviews for matching tags (excluding soft-deleted)
  const tagReviewIds = [...new Set(tagRows.map(t => t.reviewId))]
  const tagReviewRows = tagReviewIds.length > 0
    ? await db.select().from(reviews).where(
        and(inArray(reviews.id, tagReviewIds), isNull(reviews.deletedAt))
      ).limit(50)
    : []

  // Collect all review IDs we need to enrich
  const allReviewRows = deduplicateById([...mealRows, ...tagReviewRows])
  const allReviewIds = allReviewRows.map(r => r.id)

  if (allReviewIds.length === 0) {
    // No reviews to enrich — return early with users and restaurants
    const enrichedUsers = enrichUsers(userRows, actorUserId, followingSet, friendSet)
    return NextResponse.json({
      users: enrichedUsers,
      meals: [],
      restaurants: restaurantRows,
      tags: [],
    })
  }

  // Batch-fetch enrichment data for all reviews (no N+1)
  const [allTagRows, allLikeRows, allRestaurantRows] = await Promise.all([
    db.select({ reviewId: reviewTags.reviewId, label: reviewTags.label })
      .from(reviewTags)
      .where(inArray(reviewTags.reviewId, allReviewIds)),
    db.select({ reviewId: likes.reviewId, userId: likes.userId })
      .from(likes)
      .where(inArray(likes.reviewId, allReviewIds)),
    (() => {
      const restaurantIds = allReviewRows.map(r => r.restaurantId).filter((id): id is string => id !== null)
      return restaurantIds.length > 0
        ? db.select({ id: restaurants.id, name: restaurants.name, address: restaurants.address })
            .from(restaurants)
            .where(inArray(restaurants.id, restaurantIds))
        : Promise.resolve([])
    })(),
  ])

  const authorIds = [...new Set(allReviewRows.map(r => r.userId))]
  const authorRows = authorIds.length > 0
    ? await db.select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
        .from(users)
        .where(inArray(users.id, authorIds))
    : []

  // Build lookup maps
  const tagsMap: Record<string, string[]> = {}
  for (const tag of allTagRows) {
    if (!tagsMap[tag.reviewId]) tagsMap[tag.reviewId] = []
    tagsMap[tag.reviewId].push(tag.label)
  }

  const likeCountMap: Record<string, number> = {}
  const likedByMeSet = new Set<string>()
  for (const row of allLikeRows) {
    likeCountMap[row.reviewId] = (likeCountMap[row.reviewId] ?? 0) + 1
    if (row.userId === actorUserId) likedByMeSet.add(row.reviewId)
  }

  const restaurantMap = Object.fromEntries(allRestaurantRows.map(r => [r.id, r]))
  const authorMap = Object.fromEntries(authorRows.map(u => [u.id, u]))

  function shapeReview(review: typeof allReviewRows[number]): ReviewResult {
    const author = authorMap[review.userId] ?? null
    return {
      id: review.id,
      mealName: review.mealName,
      body: review.body,
      rating: review.rating,
      photoUrl: review.photoUrl,
      mealType: review.mealType,
      mealDate: review.mealDate,
      createdAt: review.createdAt.toISOString(),
      tags: tagsMap[review.id] ?? [],
      restaurant: review.restaurantId ? (restaurantMap[review.restaurantId] ?? null) : null,
      likeCount: likeCountMap[review.id] ?? 0,
      isLikedByMe: likedByMeSet.has(review.id),
      isOwnReview: review.userId === actorUserId,
      isFriend: friendSet.has(review.userId) || followingSet.has(review.userId),
      author,
    }
  }

  // Sort reviews: friends/following first → then by likeCount DESC
  function sortReviews(rows: typeof allReviewRows): ReviewResult[] {
    return rows
      .map(shapeReview)
      .sort((a, b) => {
        if (a.isFriend && !b.isFriend) return -1
        if (!a.isFriend && b.isFriend) return 1
        return b.likeCount - a.likeCount
      })
  }

  const mealReviewIds = new Set(mealRows.map(r => r.id))
  const tagReviewIdSet = new Set(tagReviewRows.map(r => r.id))

  const enrichedMeals = sortReviews(allReviewRows.filter(r => mealReviewIds.has(r.id)))
  const enrichedTags = sortReviews(allReviewRows.filter(r => tagReviewIdSet.has(r.id) && !mealReviewIds.has(r.id)))

  // Enrich users with follow state
  const enrichedUsers = enrichUsers(userRows, actorUserId, followingSet, friendSet)

  return NextResponse.json({
    users: enrichedUsers,
    meals: enrichedMeals,
    restaurants: restaurantRows,
    tags: enrichedTags,
  })
}

function deduplicateById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>()
  return arr.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function enrichUsers(
  userRows: { id: string; username: string; displayName: string | null; avatarUrl: string | null }[],
  actorUserId: string,
  followingSet: Set<string>,
  friendSet: Set<string>
) {
  return userRows.map(u => ({
    ...u,
    followState: friendSet.has(u.id) ? 'friends' as const
      : followingSet.has(u.id) ? 'following' as const
      : 'none' as const,
  }))
}
