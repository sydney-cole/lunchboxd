import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { likes } from '@/lib/schema'
import { likeSchema } from '@lunchboxd/shared'
import { resolveUserId } from '@/lib/queries'
import { eq, and, sql } from 'drizzle-orm'

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
  }

  // Count current likes for response (not denormalized — COUNT query per research recommendation)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(likes)
    .where(eq(likes.reviewId, reviewId))

  return NextResponse.json({ liked: !existingLike, likeCount: count })
}
