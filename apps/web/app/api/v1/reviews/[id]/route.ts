import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { reviews, reviewTags, feedItems } from '@/lib/schema'
import { reviewSchema } from '@lunchboxd/shared'
import { resolveUserId } from '@/lib/queries'
import { eq, and, isNull } from 'drizzle-orm'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params   // Next.js 16: params is a Promise
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Check ownership
  const [existing] = await db.select({ userId: reviews.userId })
    .from(reviews)
    .where(and(eq(reviews.id, id), isNull(reviews.deletedAt)))

  if (!existing) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  if (existing.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = reviewSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const input = parsed.data

  // Validate photoKey ownership: key must be reviews/<clerkId>/<uuid>
  if (input.photoKey) {
    const photoKeyPattern = /^reviews\/[a-zA-Z0-9_-]+\/[0-9a-f-]{36}$/
    if (!photoKeyPattern.test(input.photoKey)) {
      return NextResponse.json({ error: 'Invalid photoKey format' }, { status: 400 })
    }
    const keyClerkId = input.photoKey.split('/')[1]
    if (keyClerkId !== clerkId) {
      return NextResponse.json({ error: 'photoKey does not belong to authenticated user' }, { status: 400 })
    }
  }

  // Build update set — only include fields that were provided
  const updateSet: Record<string, unknown> = { updatedAt: new Date() }
  if (input.mealType !== undefined) updateSet.mealType = input.mealType
  if (input.restaurantId !== undefined) updateSet.restaurantId = input.restaurantId ?? null
  if (input.note !== undefined) updateSet.body = input.note ?? null
  if (input.rating !== undefined) updateSet.rating = input.rating?.toString() ?? null
  if (input.photoKey !== undefined) {
    updateSet.photoUrl = input.photoKey
      ? `${process.env.R2_PUBLIC_URL}/${input.photoKey}`
      : null
  }
  if (input.mealDate !== undefined) updateSet.mealDate = input.mealDate ?? null

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(reviews)
      .set(updateSet)
      .where(eq(reviews.id, id))
      .returning()

    // Replace tags atomically within the same transaction
    if (input.tags !== undefined) {
      await tx.delete(reviewTags).where(eq(reviewTags.reviewId, id))
      if (input.tags.length > 0) {
        await tx.insert(reviewTags).values(
          input.tags.map((label: string) => ({
            reviewId: id,
            label: label.toLowerCase().trim(),
          }))
        )
      }
    }

    return row
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params   // Next.js 16: params is a Promise
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Check ownership
  const [existing] = await db.select({ userId: reviews.userId })
    .from(reviews)
    .where(and(eq(reviews.id, id), isNull(reviews.deletedAt)))

  if (!existing) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  if (existing.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Soft-delete the review
  await db.update(reviews)
    .set({ deletedAt: new Date() })
    .where(eq(reviews.id, id))

  // Hard-delete feed_items for this review (denormalized cache rows)
  await db.delete(feedItems).where(eq(feedItems.reviewId, id))

  return NextResponse.json({ success: true })
}
