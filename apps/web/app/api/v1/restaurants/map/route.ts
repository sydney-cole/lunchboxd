import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { restaurants, reviews, follows } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { eq, and, isNotNull, isNull } from 'drizzle-orm'

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

    // Step 2: All restaurants with coordinates that have at least one non-deleted review
    // selectDistinct prevents duplicate rows when a restaurant has multiple reviews
    const reviewedRows = await db
      .selectDistinct({
        id: restaurants.id,
        name: restaurants.name,
        lat: restaurants.lat,
        lng: restaurants.lng,
        reviewUserId: reviews.userId,
      })
      .from(restaurants)
      .innerJoin(reviews, eq(reviews.restaurantId, restaurants.id))
      .where(
        and(
          isNotNull(restaurants.lat),
          isNotNull(restaurants.lng),
          isNull(reviews.deletedAt)
        )
      )
      .limit(500) // Hard cap — prevents unbounded memory/response size; add viewport query in a follow-up

    // Step 3: Deduplicate by restaurant ID; upgrade reviewedByFollowed if any reviewer is followed
    type MapPin = { id: string; name: string; lat: string; lng: string; reviewedByFollowed: boolean }
    const restaurantMap = new Map<string, MapPin>()
    for (const row of reviewedRows) {
      const isFollowed = followingSet.has(row.reviewUserId)
      const existing = restaurantMap.get(row.id)
      if (!existing) {
        restaurantMap.set(row.id, {
          id: row.id,
          name: row.name,
          lat: row.lat!,   // non-null guaranteed by WHERE isNotNull
          lng: row.lng!,
          reviewedByFollowed: isFollowed,
        })
      } else if (isFollowed && !existing.reviewedByFollowed) {
        // Upgrade: this restaurant was also reviewed by a followed user
        existing.reviewedByFollowed = true
      }
    }

    return NextResponse.json(Array.from(restaurantMap.values()))
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
