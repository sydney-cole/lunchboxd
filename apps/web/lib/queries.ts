import { db } from '@/lib/db'
import { users, follows, feedItems } from '@/lib/schema'
import { eq } from 'drizzle-orm'

/** Resolve internal user UUID from Clerk's clerkId string */
export async function resolveUserId(clerkId: string): Promise<string | null> {
  const [user] = await db.select({ id: users.id })
    .from(users).where(eq(users.clerkId, clerkId))
  return user?.id ?? null
}

/**
 * Fan-out-on-write: insert a feed_items row for the author
 * and each of their followers.
 * Designed to be extractable to a background job in Phase 3+.
 */
export async function fanOutToFollowers(
  reviewId: string,
  authorUserId: string,
  reviewCreatedAt: Date
) {
  const followerRows = await db.select({ followerId: follows.followerId })
    .from(follows).where(eq(follows.followeeId, authorUserId))

  const feedRows = [
    { ownerUserId: authorUserId, reviewId, createdAt: reviewCreatedAt },
    ...followerRows.map(f => ({
      ownerUserId: f.followerId,
      reviewId,
      createdAt: reviewCreatedAt,
    })),
  ]

  if (feedRows.length > 0) {
    await db.insert(feedItems).values(feedRows)
  }
}
