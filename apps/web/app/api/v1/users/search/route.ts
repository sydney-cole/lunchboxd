import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, follows, friendships } from '@/lib/schema'
import { userSearchSchema } from '@lunchboxd/shared'
import { resolveUserId } from '@/lib/queries'
import { eq, and, or, ilike, inArray, ne } from 'drizzle-orm'

export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actorUserId = await resolveUserId(clerkId)
  if (!actorUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Parse query param
  const { searchParams } = new URL(req.url)
  const parsed = userSearchSchema.safeParse({ q: searchParams.get('q') ?? '' })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Query must be 2-100 characters' }, { status: 400 })
  }

  const searchTerm = `%${parsed.data.q}%`

  // T-03-03: Only select safe fields — NO email, NO clerkId
  const results = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(
      and(
        or(
          ilike(users.username, searchTerm),
          ilike(users.displayName, searchTerm)
        ),
        ne(users.id, actorUserId)  // exclude self from results
      )
    )
    .limit(20)

  if (results.length === 0) {
    return NextResponse.json([])
  }

  // Batch follow-state lookup (NOT N+1 — one query per table)
  const resultIds = results.map(r => r.id)

  const followedByMe = await db
    .select({ followeeId: follows.followeeId })
    .from(follows)
    .where(and(eq(follows.followerId, actorUserId), inArray(follows.followeeId, resultIds)))

  const friendsWith = await db
    .select({ userAId: friendships.userAId, userBId: friendships.userBId })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.userAId, actorUserId), inArray(friendships.userBId, resultIds)),
        and(eq(friendships.userBId, actorUserId), inArray(friendships.userAId, resultIds))
      )
    )

  // Build follow state sets
  const followedSet = new Set(followedByMe.map(f => f.followeeId))
  const friendSet = new Set([
    ...friendsWith.filter(f => f.userAId === actorUserId).map(f => f.userBId),
    ...friendsWith.filter(f => f.userBId === actorUserId).map(f => f.userAId),
  ])

  // Enrich results with followState (per D-07: none | following | friends)
  const enriched = results.map(r => ({
    ...r,
    followState: friendSet.has(r.id)
      ? 'friends' as const
      : followedSet.has(r.id)
        ? 'following' as const
        : 'none' as const,
  }))

  return NextResponse.json(enriched)
}
