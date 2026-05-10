import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, userStats, reviews, reviewTags, likes, follows, friendships } from '@/lib/schema'
import { eq, and, isNull, desc, inArray } from 'drizzle-orm'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  // Next.js 16: params is a Promise — must await
  const { username } = await params

  // Auth is optional for public profile (viewer may be unauthenticated)
  const { userId: clerkId } = await auth()

  // Resolve viewer's internal user ID early (needed for isOwner + isLikedByMe)
  let viewerUserId: string | null = null
  if (clerkId) {
    const [viewer] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId))
    viewerUserId = viewer?.id ?? null
  }

  // 1. Fetch user by username (safe fields only — no email, no clerkId)
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })
    .from(users)
    .where(eq(users.username, username))

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // 2. Fetch userStats (followerCount, followingCount, reviewCount)
  const [stats] = await db
    .select({
      followerCount: userStats.followerCount,
      followingCount: userStats.followingCount,
      reviewCount: userStats.reviewCount,
    })
    .from(userStats)
    .where(eq(userStats.userId, user.id))

  // 3. Fetch 10 most recent non-deleted reviews for this user
  const recentReviews = await db
    .select({
      id: reviews.id,
      body: reviews.body,
      rating: reviews.rating,
      photoUrl: reviews.photoUrl,
      mealType: reviews.mealType,
      mealDate: reviews.mealDate,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.userId, user.id), isNull(reviews.deletedAt)))
    .orderBy(desc(reviews.createdAt))
    .limit(10)

  // 4. Batch-fetch tags and like counts (no N+1)
  let enrichedReviews = recentReviews.map(r => ({ ...r, tags: [] as string[], likeCount: 0, isLikedByMe: false }))

  if (recentReviews.length > 0) {
    const reviewIds = recentReviews.map(r => r.id)

    const tags = await db
      .select({ reviewId: reviewTags.reviewId, label: reviewTags.label })
      .from(reviewTags)
      .where(inArray(reviewTags.reviewId, reviewIds))

    const allLikes = await db
      .select({ reviewId: likes.reviewId, userId: likes.userId })
      .from(likes)
      .where(inArray(likes.reviewId, reviewIds))

    const tagMap = new Map<string, string[]>()
    for (const t of tags) {
      const arr = tagMap.get(t.reviewId) ?? []
      arr.push(t.label)
      tagMap.set(t.reviewId, arr)
    }

    const likeCountMap = new Map<string, number>()
    const likedByMeSet = new Set<string>()
    for (const l of allLikes) {
      likeCountMap.set(l.reviewId, (likeCountMap.get(l.reviewId) ?? 0) + 1)
      if (viewerUserId && l.userId === viewerUserId) likedByMeSet.add(l.reviewId)
    }

    enrichedReviews = recentReviews.map(r => ({
      ...r,
      tags: tagMap.get(r.id) ?? [],
      likeCount: likeCountMap.get(r.id) ?? 0,
      isLikedByMe: likedByMeSet.has(r.id),
    }))
  }

  // HI-06: Include followState for authenticated viewers so the profile page FollowButton
  // can show the correct initial state instead of always defaulting to 'none'.
  let followState: 'none' | 'following' | 'friends' = 'none'
  if (viewerUserId && viewerUserId !== user.id) {
    const [followRow] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, viewerUserId), eq(follows.followeeId, user.id)))
    if (followRow) {
      // Check if mutual (friendship)
      const [friendRow] = await db
        .select({ id: friendships.id })
        .from(friendships)
        .where(
          and(
            eq(friendships.userAId, viewerUserId),
            eq(friendships.userBId, user.id)
          )
        )
      // Also check reverse direction (friendships stored as (A, B) not necessarily (viewer, target))
      const [friendRowReverse] = friendRow ? [friendRow] : await db
        .select({ id: friendships.id })
        .from(friendships)
        .where(
          and(
            eq(friendships.userAId, user.id),
            eq(friendships.userBId, viewerUserId)
          )
        )
      followState = (friendRow || friendRowReverse) ? 'friends' : 'following'
    }
  }

  return NextResponse.json({
    user,
    stats: stats ?? { followerCount: '0', followingCount: '0', reviewCount: '0' },
    reviews: enrichedReviews,
    isOwner: viewerUserId === user.id,
    followState,
  })
}
