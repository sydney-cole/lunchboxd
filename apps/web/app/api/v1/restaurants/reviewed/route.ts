import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { restaurants, reviews, follows } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { restaurantReviewedQuerySchema } from '@lunchboxd/shared'
import { eq, and, isNull, ilike, or } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const parsed = restaurantReviewedQuerySchema.safeParse({
    q: req.nextUrl.searchParams.get('q') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query params', issues: parsed.error.issues }, { status: 400 })
  }
  const { q } = parsed.data

  try {
    // Fetch following set for social signal
    const followingRows = await db
      .select({ followeeId: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, userId))
    const followingSet = new Set(followingRows.map(f => f.followeeId))

    // Build WHERE: must have at least one review (INNER JOIN); optional ILIKE filter on city OR address
    const searchCondition = q && q.trim().length > 0
      ? or(
          ilike(restaurants.city, `%${q}%`),
          ilike(restaurants.address, `%${q}%`)
        )
      : undefined

    const whereCondition = searchCondition
      ? and(isNull(reviews.deletedAt), searchCondition)
      : isNull(reviews.deletedAt)

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

    // Deduplicate by restaurant ID; compute reviewedByFollowed
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

    return NextResponse.json(Array.from(restaurantMap.values()))
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
