import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { restaurants, reviews, follows } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { restaurantReviewedQuerySchema } from '@lunchboxd/shared'
import { eq, and, isNull, ilike, inArray, type SQL, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const parsed = restaurantReviewedQuerySchema.safeParse({
    q: req.nextUrl.searchParams.get('q') ?? undefined,
    filter: req.nextUrl.searchParams.get('filter') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query params', issues: parsed.error.issues }, { status: 400 })
  }
  const { q, filter } = parsed.data

  try {
    const followingRows = await db
      .select({ followeeId: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, userId))
    const followingSet = new Set(followingRows.map(f => f.followeeId))

    // Short-circuit: friends filter with no follows returns empty
    if (filter === 'friends' && followingRows.length === 0) {
      return NextResponse.json([])
    }

    const nameCondition = q && q.trim().length > 0
      ? ilike(restaurants.name, `%${q}%`)
      : undefined

    // 'anywhere' has no user restriction — all reviewed restaurants
    const userCondition =
      filter === 'mine' ? eq(reviews.userId, userId)
      : filter === 'friends' ? inArray(reviews.userId, Array.from(followingSet))
      : undefined

    const conditions: SQL[] = [isNull(reviews.deletedAt) as SQL]
    if (nameCondition) conditions.push(nameCondition as SQL)
    if (userCondition) conditions.push(userCondition as SQL)

    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0]

    const reviewedRows = await db
      .selectDistinct({
        id: restaurants.id,
        name: restaurants.name,
        city: restaurants.city,
        address: restaurants.address,
        lat: restaurants.lat,
        lng: restaurants.lng,
        reviewUserId: reviews.userId,
      })
      .from(restaurants)
      .innerJoin(reviews, eq(reviews.restaurantId, restaurants.id))
      .where(whereCondition)

    type ReviewedRestaurant = {
      id: string; name: string; city: string | null; address: string | null;
      lat: string | null; lng: string | null; reviewedByFollowed: boolean
    }
    const restaurantMap = new Map<string, ReviewedRestaurant>()
    for (const row of reviewedRows) {
      const isFollowed = followingSet.has(row.reviewUserId)
      const existing = restaurantMap.get(row.id)
      if (!existing) {
        restaurantMap.set(row.id, {
          id: row.id, name: row.name, city: row.city, address: row.address,
          lat: row.lat, lng: row.lng,
          reviewedByFollowed: isFollowed,
        })
      } else if (isFollowed && !existing.reviewedByFollowed) {
        existing.reviewedByFollowed = true
      }
    }

    const dedupedRestaurants = Array.from(restaurantMap.values())
    const restaurantIds = dedupedRestaurants.map(r => r.id)
    const countRows = restaurantIds.length > 0
      ? await db
          .select({ restaurantId: reviews.restaurantId, count: sql<number>`count(*)::int` })
          .from(reviews)
          .where(and(inArray(reviews.restaurantId, restaurantIds), isNull(reviews.deletedAt)))
          .groupBy(reviews.restaurantId)
      : []
    const countMap = new Map(countRows.map(c => [c.restaurantId, c.count]))

    return NextResponse.json(dedupedRestaurants.map(r => ({ ...r, reviewCount: countMap.get(r.id) ?? 0 })))
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
