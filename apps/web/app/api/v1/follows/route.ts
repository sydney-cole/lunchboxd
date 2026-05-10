import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { follows, friendships, userStats, feedItems, reviews, notifications } from '@/lib/schema'
import { followSchema } from '@lunchboxd/shared'
import { resolveUserId } from '@/lib/queries'
import { eq, and, sql, isNull, inArray } from 'drizzle-orm'

export async function POST(req: Request) {
  // T-03-01: Auth check — actor derived from Clerk session, never request body
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actorUserId = await resolveUserId(clerkId)
  if (!actorUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = followSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { targetUserId } = parsed.data

  // Prevent self-follow
  if (targetUserId === actorUserId) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
  }

  // 1. Insert follow (idempotent — followsUniqueIdx prevents duplicates)
  const inserted = await db.insert(follows)
    .values({ followerId: actorUserId, followeeId: targetUserId })
    .onConflictDoNothing()
    .returning({ id: follows.id })

  // D-01: notification INSERT inline — only when a new follow row was actually created
  // D-02: skip self-notification (actorId === userId — already blocked by self-follow guard above, but guard here too)
  // T-06-02-04: actorId always set to actorUserId from resolveUserId(clerkId) — never from request body
  if (inserted.length > 0 && targetUserId !== actorUserId) {
    await db.insert(notifications).values({
      userId: targetUserId,   // who receives the notification (the person being followed)
      type: 'follow',
      actorId: actorUserId,   // who performed the action
      // reviewId: omitted — defaults to null for follow notifications
    })
  }

  // 2. Check reverse follow for mutual friendship detection (per D-04, D-08)
  const [reverseFollow] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, targetUserId), eq(follows.followeeId, actorUserId)))

  let followState: 'following' | 'friends' = 'following'
  if (reverseFollow) {
    // Mutual — write friendship (friendshipsUniqueIdx prevents duplicates)
    await db.insert(friendships)
      .values({ userAId: actorUserId, userBId: targetUserId })
      .onConflictDoNothing()
    followState = 'friends'
  }

  // CR-04: Gate stats upserts on inserted.length > 0 — prevents counter corruption on repeated POST
  if (inserted.length > 0) {
    // 3. Upsert userStats for actor (increment followingCount)
    // CRITICAL: Use upsert, NOT bare update — userStats row may not exist (Pitfall 1)
    await db.insert(userStats)
      .values({ userId: actorUserId, followingCount: '1', followerCount: '0' })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: { followingCount: sql`${userStats.followingCount} + 1`, updatedAt: new Date() },
      })

    // 4. Upsert userStats for target (increment followerCount)
    await db.insert(userStats)
      .values({ userId: targetUserId, followerCount: '1', followingCount: '0' })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: { followerCount: sql`${userStats.followerCount} + 1`, updatedAt: new Date() },
      })
  }

  return NextResponse.json({ followState })
}

export async function DELETE(req: Request) {
  // T-03-01: Auth check — actor derived from Clerk session
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actorUserId = await resolveUserId(clerkId)
  if (!actorUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = followSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { targetUserId } = parsed.data

  // 1. Delete the follow row (per D-05) — use .returning() to check if a row was actually deleted
  const deleted = await db.delete(follows)
    .where(and(eq(follows.followerId, actorUserId), eq(follows.followeeId, targetUserId)))
    .returning({ id: follows.id })

  // 2. Delete friendship row if it exists (either direction — per D-05, D-08)
  await db.delete(friendships)
    .where(
      and(eq(friendships.userAId, actorUserId), eq(friendships.userBId, targetUserId))
    )
  await db.delete(friendships)
    .where(
      and(eq(friendships.userAId, targetUserId), eq(friendships.userBId, actorUserId))
    )

  // 3. Delete feed_items for actor where review belongs to unfollowed user (per D-05)
  // Two-step: get review IDs, then delete feed_items (Drizzle doesn't support DELETE ... WHERE IN subquery)
  const targetReviewIds = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.userId, targetUserId), isNull(reviews.deletedAt)))

  if (targetReviewIds.length > 0) {
    await db.delete(feedItems)
      .where(
        and(
          eq(feedItems.ownerUserId, actorUserId),
          inArray(feedItems.reviewId, targetReviewIds.map(r => r.id))
        )
      )
  }

  // CR-05: Gate stat decrements on deleted.length > 0 — only decrement if a follow row was actually removed
  if (deleted.length > 0) {
    // 4. Decrement userStats for actor (followingCount - 1, floor at 0)
    await db.insert(userStats)
      .values({ userId: actorUserId, followingCount: '0', followerCount: '0' })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: { followingCount: sql`GREATEST(${userStats.followingCount} - 1, 0)`, updatedAt: new Date() },
      })

    // 5. Decrement userStats for target (followerCount - 1, floor at 0)
    await db.insert(userStats)
      .values({ userId: targetUserId, followerCount: '0', followingCount: '0' })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: { followerCount: sql`GREATEST(${userStats.followerCount} - 1, 0)`, updatedAt: new Date() },
      })
  }

  return NextResponse.json({ followState: 'none' })
}
