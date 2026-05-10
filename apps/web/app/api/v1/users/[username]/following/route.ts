import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, follows, friendships } from '@/lib/schema'
import { followListQuerySchema } from '@lunchboxd/shared'
import { eq, and, or, inArray, gt, asc } from 'drizzle-orm'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const { userId: clerkId } = await auth()

  // Parse cursor and limit from query string
  const { searchParams } = new URL(req.url)
  const parsed = followListQuerySchema.safeParse({
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

  // Following: users that the profile owner follows (followerId = profileUser.id → join on followeeId)
  // Cursor uses user.id (UUID) for stable ordering
  const conditions = [
    eq(follows.followerId, profileUser.id),
    ...(cursor ? [gt(users.id, cursor)] : []),
  ]

  // limit+1 trick: fetch one extra to determine if there's a next page
  const fetchLimit = limit + 1
  // HI-05: Add .orderBy(asc(users.id)) for deterministic cursor-based pagination
  const followingRows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followeeId, users.id))
    .where(and(...conditions))
    .orderBy(asc(users.id))
    .limit(fetchLimit)

  const hasMore = followingRows.length === fetchLimit
  const items = hasMore ? followingRows.slice(0, limit) : followingRows
  const nextCursor = hasMore ? items[items.length - 1].id : null

  if (items.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null })
  }

  const resultIds = items.map(r => r.id)

  // Batch follow-state enrichment (only if viewer is authenticated)
  let followedSet = new Set<string>()
  let friendSet = new Set<string>()

  if (clerkId) {
    const [viewer] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId))
    if (viewer) {
      const followedByMe = await db
        .select({ followeeId: follows.followeeId })
        .from(follows)
        .where(and(eq(follows.followerId, viewer.id), inArray(follows.followeeId, resultIds)))

      const friendsWith = await db
        .select({ userAId: friendships.userAId, userBId: friendships.userBId })
        .from(friendships)
        .where(
          or(
            and(eq(friendships.userAId, viewer.id), inArray(friendships.userBId, resultIds)),
            and(eq(friendships.userBId, viewer.id), inArray(friendships.userAId, resultIds))
          )
        )

      followedSet = new Set(followedByMe.map(f => f.followeeId))
      friendSet = new Set([
        ...friendsWith.filter(f => f.userAId === viewer.id).map(f => f.userBId),
        ...friendsWith.filter(f => f.userBId === viewer.id).map(f => f.userAId),
      ])
    }
  }

  const enriched = items.map(r => ({
    ...r,
    followState: friendSet.has(r.id)
      ? 'friends' as const
      : followedSet.has(r.id)
        ? 'following' as const
        : 'none' as const,
  }))

  return NextResponse.json({ items: enriched, nextCursor })
}
