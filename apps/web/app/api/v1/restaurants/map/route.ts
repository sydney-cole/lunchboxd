import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { restaurants, reviews, follows } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { eq, and, isNotNull, isNull, inArray } from 'drizzle-orm'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    // Step 1: Fetch the set of user IDs that the current user follows
    const followingRows = await db
      .select({ followeeId: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, userId))
    const followingSet = new Set(followingRows.map(f => f.followeeId))

    // HI-09: Use groupBy to get one row per restaurant instead of selectDistinct with reviewUserId.
    // selectDistinct on (id, name, lat, lng, reviewUserId) returns one row per (restaurant, reviewer),
    // defeating the limit(500) cap. groupBy collapses to one row per restaurant.
    //
    // Step 2a: Get the distinct set of restaurant IDs with at least one non-deleted review
    const reviewedRestaurantRows = await db
      .select({ restaurantId: reviews.restaurantId, reviewUserId: reviews.userId })
      .from(reviews)
      .where(isNull(reviews.deletedAt))

    // Collect unique restaurant IDs and whether any reviewer is followed
    type RestaurantMeta = { reviewedByFollowed: boolean }
    const restaurantMeta = new Map<string, RestaurantMeta>()
    for (const row of reviewedRestaurantRows) {
      if (!row.restaurantId) continue
      const existing = restaurantMeta.get(row.restaurantId)
      const isFollowed = followingSet.has(row.reviewUserId)
      if (!existing) {
        restaurantMeta.set(row.restaurantId, { reviewedByFollowed: isFollowed })
      } else if (isFollowed && !existing.reviewedByFollowed) {
        existing.reviewedByFollowed = true
      }
    }

    const restaurantIds = Array.from(restaurantMeta.keys())
    if (restaurantIds.length === 0) {
      return NextResponse.json([])
    }

    // Step 2b: Fetch restaurant details (coordinates required) in a single query
    const restaurantRows = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        lat: restaurants.lat,
        lng: restaurants.lng,
      })
      .from(restaurants)
      .where(
        and(
          isNotNull(restaurants.lat),
          isNotNull(restaurants.lng),
          inArray(restaurants.id, restaurantIds.slice(0, 500)) // Hard cap to prevent unbounded response
        )
      )

    // Step 3: Merge restaurant details with follow metadata
    type MapPin = { id: string; name: string; lat: string; lng: string; reviewedByFollowed: boolean }
    const mapPins: MapPin[] = restaurantRows.map(row => ({
      id: row.id,
      name: row.name,
      lat: row.lat!,   // non-null guaranteed by WHERE isNotNull
      lng: row.lng!,
      reviewedByFollowed: restaurantMeta.get(row.id)?.reviewedByFollowed ?? false,
    }))

    return NextResponse.json(mapPins)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
