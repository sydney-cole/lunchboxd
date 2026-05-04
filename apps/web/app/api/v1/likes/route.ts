import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { likes, notifications, reviews } from '@/lib/schema'
import { likeSchema } from '@lunchboxd/shared'
import { resolveUserId } from '@/lib/queries'
import { eq, and, sql, isNull } from 'drizzle-orm'

export async function POST(req: Request) {
  // T-03-02: Auth check — actor derived from Clerk session
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actorUserId = await resolveUserId(clerkId)
  if (!actorUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const parsed = likeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { reviewId } = parsed.data

  // Check existing like (per D-11: like is a toggle)
  const [existingLike] = await db
    .select({ id: likes.id })
    .from(likes)
    .where(and(eq(likes.userId, actorUserId), eq(likes.reviewId, reviewId)))

  if (existingLike) {
    // Unlike — delete the row
    await db.delete(likes).where(eq(likes.id, existingLike.id))
  } else {
    // Like — insert (likesUniqueIdx prevents duplicates on race condition)
    await db.insert(likes)
      .values({ userId: actorUserId, reviewId })
      .onConflictDoNothing()

    // D-01: notification INSERT — like branch only (D-06 / T-06-02-05: no notification on unlike)
    // Fetch review owner to determine userId for the notification
    // Filter deletedAt IS NULL so we don't notify on soft-deleted reviews
    const [review] = await db
      .select({ userId: reviews.userId })
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), isNull(reviews.deletedAt)))

    // If review is null here, the like target is deleted — return 404
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // D-02: skip self-notification
    // T-06-02-04: actorId always set to actorUserId from resolveUserId(clerkId) — never from request body
    if (review.userId !== actorUserId) {
      await db.insert(notifications).values({
        userId: review.userId,   // who receives the notification (review owner)
        type: 'like',
        actorId: actorUserId,    // who liked the review
        reviewId,
      })
    }
  }

  // Count current likes for response (not denormalized — COUNT query per research recommendation)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likes)
    .where(eq(likes.reviewId, reviewId))

  return NextResponse.json({ liked: !existingLike, likeCount: count })
}
