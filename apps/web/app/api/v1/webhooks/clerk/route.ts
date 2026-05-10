export const runtime = 'nodejs'

import { Webhook } from 'svix'
import { headers } from 'next/headers'
import type { WebhookEvent } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, notifications, likes, feedItems, reviewTags, reviews, follows, friendships, userStats } from '@/lib/schema'
import { eq, or, inArray } from 'drizzle-orm'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    throw new Error('Missing CLERK_WEBHOOK_SECRET environment variable')
  }

  // Next.js 16: headers() is async
  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const svixHeaders = {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let event: WebhookEvent

  try {
    event = wh.verify(body, svixHeaders) as WebhookEvent
  } catch {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  if (event.type === 'user.created') {
    const email = event.data.email_addresses[0]?.email_address ?? ''
    // Upsert — POST /api/v1/users may have already created the row with username
    await db.insert(users).values({
      clerkId: event.data.id,
      email,
      username: '', // will be set by POST /api/v1/users (Pitfall 4 from RESEARCH.md)
    }).onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email,
        updatedAt: new Date(),
      },
    })
  } else if (event.type === 'user.updated') {
    const email = event.data.email_addresses[0]?.email_address ?? ''
    const displayName = [event.data.first_name, event.data.last_name]
      .filter(Boolean)
      .join(' ') || null
    const imageUrl = event.data.image_url ?? null
    // LO-06: Only set avatarUrl from Clerk when the current DB value is null.
    // Read current value first, then conditionally include avatarUrl in the SET clause.
    const [currentUser] = await db.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.clerkId, event.data.id))
    const updateSet: Partial<typeof users.$inferInsert> & { updatedAt: Date } = {
      email,
      displayName,
      updatedAt: new Date(),
    }
    // Only overwrite avatarUrl from Clerk if user has not set a custom avatar (avatarUrl is null)
    if (!currentUser || currentUser.avatarUrl === null) {
      updateSet.avatarUrl = imageUrl
    }
    await db
      .update(users)
      .set(updateSet)
      .where(eq(users.clerkId, event.data.id))
  } else if (event.type === 'user.deleted') {
    if (event.data.id) {
      // CR-03: Delete dependent rows before the user row to avoid FK constraint violations.
      // Soft-delete reviews (preserves social history); hard-delete all other dependent rows.
      try {
        // 1. Resolve the internal user UUID from clerkId
        const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, event.data.id))
        if (!targetUser) {
          // User row doesn't exist — nothing to clean up
          return new Response('OK', { status: 200 })
        }
        const userId = targetUser.id

        // 2. Delete notifications where userId = userId OR actorId = userId
        await db.delete(notifications).where(
          or(eq(notifications.userId, userId), eq(notifications.actorId, userId))
        )

        // 3. Delete likes where userId = userId
        await db.delete(likes).where(eq(likes.userId, userId))

        // 4. Delete feedItems where ownerUserId = userId
        await db.delete(feedItems).where(eq(feedItems.ownerUserId, userId))

        // 5. Delete reviewTags for this user's reviews
        const userReviewIds = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.userId, userId))
        if (userReviewIds.length > 0) {
          await db.delete(reviewTags).where(inArray(reviewTags.reviewId, userReviewIds.map(r => r.id)))
        }

        // 6. Soft-delete reviews (preserve social history — review text stays but is hidden)
        await db.update(reviews).set({ deletedAt: new Date() }).where(eq(reviews.userId, userId))

        // 7. Delete follows (both directions)
        await db.delete(follows).where(
          or(eq(follows.followerId, userId), eq(follows.followeeId, userId))
        )

        // 8. Delete friendships (both directions)
        await db.delete(friendships).where(
          or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))
        )

        // 9. Delete userStats
        await db.delete(userStats).where(eq(userStats.userId, userId))

        // 10. Finally delete the user row
        await db.delete(users).where(eq(users.id, userId))
      } catch (err) {
        console.error('[webhook] user.deleted cleanup error:', err)
        return new Response(JSON.stringify({ error: 'Failed to delete user data' }), { status: 500 })
      }
    }
  }

  return new Response('OK', { status: 200 })
}
