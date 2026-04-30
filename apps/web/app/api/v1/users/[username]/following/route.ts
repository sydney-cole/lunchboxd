import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, follows, friendships } from '@/lib/schema'
import { eq, and, or, inArray } from 'drizzle-orm'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const { userId: clerkId } = await auth()

  // Resolve profile user
  const [profileUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))

  if (!profileUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Following: users that the profile owner follows (followerId = profileUser.id → join on followeeId)
  const followingRows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(follows)
    .innerJoin(users, eq(follows.followeeId, users.id))
    .where(eq(follows.followerId, profileUser.id))

  if (followingRows.length === 0) {
    return NextResponse.json([])
  }

  const resultIds = followingRows.map(r => r.id)

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

  const enriched = followingRows.map(r => ({
    ...r,
    followState: friendSet.has(r.id)
      ? 'friends' as const
      : followedSet.has(r.id)
        ? 'following' as const
        : 'none' as const,
  }))

  return NextResponse.json(enriched)
}
