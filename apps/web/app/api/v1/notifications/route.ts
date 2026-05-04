import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifications, users, reviews, restaurants } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { notificationQuerySchema } from '@lunchboxd/shared'
import { eq, lt, and, desc, inArray } from 'drizzle-orm'

export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const parsed = notificationQuerySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query params', issues: parsed.error.issues }, { status: 400 })
  }
  const { cursor, limit } = parsed.data
  const PAGE_SIZE = limit ?? 20

  // T-06-02-01: WHERE userId = $me scopes all results to authenticated user
  // T-06-02-02: cursor validated as ISO 8601 datetime by notificationQuerySchema before use in lt()
  const whereClause = cursor
    ? and(eq(notifications.userId, userId), lt(notifications.createdAt, new Date(cursor)))
    : eq(notifications.userId, userId)

  const rawRows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      read: notifications.read,
      createdAt: notifications.createdAt,
      actorId: notifications.actorId,
      reviewId: notifications.reviewId,
    })
    .from(notifications)
    .where(whereClause)
    .orderBy(desc(notifications.createdAt))
    .limit(PAGE_SIZE + 1)

  const hasMore = rawRows.length > PAGE_SIZE
  const pageRows = rawRows.slice(0, PAGE_SIZE)
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].createdAt.toISOString() : null

  if (pageRows.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null })
  }

  // Batch-fetch actor users (no N+1)
  const actorIds = [...new Set(pageRows.map(r => r.actorId).filter((id): id is string => id !== null))]
  const actorRows = actorIds.length > 0
    ? await db
        .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
        .from(users)
        .where(inArray(users.id, actorIds))
    : []
  const actorMap = Object.fromEntries(actorRows.map(u => [u.id, u]))

  // Batch-fetch restaurant names for like notifications (no N+1)
  const reviewIds = [...new Set(pageRows.map(r => r.reviewId).filter((id): id is string => id !== null))]
  const restaurantNameMap: Record<string, string | null> = {}
  if (reviewIds.length > 0) {
    const reviewRows = await db
      .select({ id: reviews.id, restaurantId: reviews.restaurantId })
      .from(reviews)
      .where(inArray(reviews.id, reviewIds))
    const restaurantIds = reviewRows
      .map(r => r.restaurantId)
      .filter((id): id is string => id !== null)
    const restaurantRows = restaurantIds.length > 0
      ? await db
          .select({ id: restaurants.id, name: restaurants.name })
          .from(restaurants)
          .where(inArray(restaurants.id, restaurantIds))
      : []
    const restaurantMap = Object.fromEntries(restaurantRows.map(r => [r.id, r.name]))
    for (const review of reviewRows) {
      restaurantNameMap[review.id] = review.restaurantId ? (restaurantMap[review.restaurantId] ?? null) : null
    }
  }

  const items = pageRows.map(row => ({
    id: row.id,
    type: row.type,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
    actor: row.actorId ? (actorMap[row.actorId] ?? null) : null,
    reviewId: row.reviewId,
    restaurantName: row.reviewId ? (restaurantNameMap[row.reviewId] ?? null) : null,
  }))

  return NextResponse.json({ items, nextCursor })
}
