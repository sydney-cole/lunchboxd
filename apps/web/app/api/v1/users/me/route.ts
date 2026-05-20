import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, reviews, reviewTags, follows, friendships, feedItems, likes, notifications, userStats } from '@/lib/schema'
import { patchUserSchema } from '@lunchboxd/shared'
import { resolveUserId } from '@/lib/queries'
import { eq, or, inArray } from 'drizzle-orm'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [user] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, bio: users.bio, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.clerkId, clerkId))

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ user })
}

export async function PATCH(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actorUserId = await resolveUserId(clerkId)
  if (!actorUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = patchUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { bio, displayName, avatarUrl } = parsed.data

  // Security: avatarUrl ownership check — path must contain /avatars/<clerkId>/
  if (avatarUrl) {
    try {
      const parts = new URL(avatarUrl).pathname.split('/')
      const avatarsIdx = parts.indexOf('avatars')
      if (avatarsIdx === -1 || parts[avatarsIdx + 1] !== clerkId) {
        return NextResponse.json({ error: 'avatarUrl does not belong to authenticated user' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid avatarUrl' }, { status: 400 })
    }
  }

  // Build update object — only include fields that were actually provided
  const updateData: Record<string, string | undefined | Date> = {
    updatedAt: new Date(),
  }
  if (bio !== undefined) updateData.bio = bio
  if (displayName !== undefined) updateData.displayName = displayName
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl

  await db.update(users).set(updateData).where(eq(users.id, actorUserId))

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Delete in FK-safe order
  await db.delete(notifications).where(or(eq(notifications.userId, userId), eq(notifications.actorId, userId)))
  await db.delete(likes).where(eq(likes.userId, userId))
  await db.delete(feedItems).where(eq(feedItems.ownerUserId, userId))
  await db.delete(follows).where(or(eq(follows.followerId, userId), eq(follows.followeeId, userId)))
  await db.delete(friendships).where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)))

  const userReviews = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.userId, userId))
  if (userReviews.length > 0) {
    const reviewIds = userReviews.map(r => r.id)
    await db.delete(reviewTags).where(inArray(reviewTags.reviewId, reviewIds))
  }
  await db.delete(reviews).where(eq(reviews.userId, userId))
  await db.delete(userStats).where(eq(userStats.userId, userId))
  await db.delete(users).where(eq(users.id, userId))

  const client = await clerkClient()
  await client.users.deleteUser(clerkId)

  return NextResponse.json({ ok: true })
}
