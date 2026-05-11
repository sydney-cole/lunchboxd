'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { ReviewCard } from '@/components/review-card'
import { FollowButton } from '@/components/follow-button'
import { DeleteDialog } from '@/components/delete-dialog'

// Types
interface ProfileUser {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
}

interface ProfileStats {
  followerCount: string
  followingCount: string
  reviewCount: string
}

interface ProfileReview {
  id: string
  mealName: string | null
  body: string | null
  rating: string | null
  photoUrl: string | null
  mealType: string
  mealDate: string | null
  createdAt: string
  tags: string[]
  restaurant: { id: string; name: string; address: string | null } | null
  likeCount: number
  isLikedByMe: boolean
}

interface ProfileReviewsPage {
  items: ProfileReview[]
  nextCursor: string | null
}

type InfiniteProfileData = {
  pages: ProfileReviewsPage[]
  pageParams: (string | null)[]
}

export default function ProfilePage() {
  const params = useParams()
  const username = params.username as string
  const queryClient = useQueryClient()
  const router = useRouter()
  const sentinelRef = useRef<HTMLDivElement>(null)
  // HI-02: deleteTarget state for delete dialog
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Fetch profile data (includes followState for HI-06)
  const { data: profile, isLoading: profileLoading, isError: profileError } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      const res = await fetch(`/api/v1/users/${username}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to load profile')
      return res.json() as Promise<{ user: ProfileUser; stats: ProfileStats; isOwner: boolean; followState: 'none' | 'following' | 'friends' }>
    },
    staleTime: 60_000,
  })

  // Infinite scroll for review list
  const {
    data: reviewsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: reviewsLoading,
  } = useInfiniteQuery<ProfileReviewsPage>({
    queryKey: ['profile-reviews', username],
    queryFn: async ({ pageParam }) => {
      const url = pageParam
        ? `/api/v1/users/${username}/reviews?cursor=${encodeURIComponent(pageParam as string)}&limit=20`
        : `/api/v1/users/${username}/reviews`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load reviews')
      return res.json()
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  })

  // IntersectionObserver sentinel
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )
    const el = sentinelRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Like mutation — targets ['profile-reviews', username] cache (NOT 'my-reviews' or 'feed')
  const likeMutation = useMutation({
    mutationFn: async ({ reviewId }: { reviewId: string }) => {
      const res = await fetch('/api/v1/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      })
      if (!res.ok) throw new Error('Like failed')
      return res.json() as Promise<{ liked: boolean; likeCount: number }>
    },
    onMutate: async ({ reviewId }) => {
      await queryClient.cancelQueries({ queryKey: ['profile-reviews', username] })
      const previousData = queryClient.getQueryData<InfiniteProfileData>(['profile-reviews', username])
      queryClient.setQueryData<InfiniteProfileData>(['profile-reviews', username], (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === reviewId
                ? { ...item, isLikedByMe: !item.isLikedByMe, likeCount: item.isLikedByMe ? item.likeCount - 1 : item.likeCount + 1 }
                : item
            ),
          })),
        }
      })
      return { previousData }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) queryClient.setQueryData(['profile-reviews', username], context.previousData)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-reviews', username] })
    },
  })

  // HI-02: Delete mutation for profile page review cards
  const deleteMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const res = await fetch(`/api/v1/reviews/${reviewId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['profile-reviews', username] })
    },
  })

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-text-secondary" />
      </div>
    )
  }

  // notFound() cannot be called in Client Components — render a custom not-found UI instead
  if (profileError || profile == null) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-[20px] font-semibold text-text-primary mb-2">Profile not found</p>
          <p className="text-[16px] text-text-secondary">This account doesn&apos;t exist or may have been removed.</p>
        </div>
      </div>
    )
  }

  const { user, stats, isOwner, followState } = profile

  const allReviews = reviewsData?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="min-h-screen bg-bg py-6 px-4">
      <div className="w-full max-w-[600px] mx-auto">

        {/* Profile header card */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-4">
            <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden mb-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={`${user.username}'s avatar`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[28px] font-medium text-accent" aria-hidden="true">
                  {user.username[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>

            {/* Username + display name */}
            <p className="text-[20px] font-semibold text-text-primary">{user.username}</p>
            {user.displayName && (
              <p className="text-[16px] text-text-secondary mt-0.5">{user.displayName}</p>
            )}

            {/* Bio */}
            {user.bio && (
              <p className="text-[16px] text-text-primary leading-relaxed mt-3 text-center">{user.bio}</p>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-1 text-[14px] text-text-secondary mb-4">
            <a
              href={`/@${user.username}/followers`}
              className="hover:underline hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent rounded"
              aria-label={`${stats.followerCount} followers`}
            >
              {stats.followerCount} followers
            </a>
            <span className="mx-1" aria-hidden="true">·</span>
            <a
              href={`/@${user.username}/following`}
              className="hover:underline hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent rounded"
              aria-label={`${stats.followingCount} following`}
            >
              {stats.followingCount} following
            </a>
          </div>

          {/* CTA: Edit Profile (own) or Follow button (others) */}
          <div className="flex justify-center">
            {isOwner ? (
              <a
                href="/profile/edit"
                className="px-4 py-2 rounded-md bg-accent text-white text-[16px] font-medium hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              >
                Edit profile
              </a>
            ) : (
              // HI-06: Pass actual followState from profile API instead of hardcoding 'none'
              <FollowButton targetUserId={user.id} initialState={followState ?? 'none'} />
            )}
          </div>
        </div>

        {/* Reviews section */}
        <h2 className="text-[20px] font-semibold text-text-primary mb-4">Reviews</h2>

        {reviewsLoading && (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-text-secondary" />
          </div>
        )}

        {!reviewsLoading && allReviews.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[20px] font-semibold text-text-primary mb-2">No reviews yet</p>
            <p className="text-[16px] text-text-secondary">
              {isOwner
                ? 'Post your first meal to see it here.'
                : `${user.username} hasn't posted any reviews.`}
            </p>
          </div>
        )}

        {allReviews.length > 0 && (
          <div className="flex flex-col gap-6">
            {allReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={{
                  id: review.id,
                  mealName: review.mealName,
                  body: review.body,
                  rating: review.rating,
                  photoUrl: review.photoUrl,
                  mealType: review.mealType,
                  mealDate: review.mealDate,
                  createdAt: review.createdAt,
                  tags: review.tags,
                  restaurant: review.restaurant,
                  likeCount: review.likeCount,
                  isLikedByMe: review.isLikedByMe,
                }}
                showAuthor={false}
                isOwnReview={isOwner}
                onEdit={(id) => router.push(`/reviews/${id}/edit`)}
                onDelete={(id) => setDeleteTarget(id)}
                onLike={(id) => likeMutation.mutate({ reviewId: id })}
              />
            ))}

            <div ref={sentinelRef} />

            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-text-secondary" />
              </div>
            )}
            {!hasNextPage && allReviews.length > 0 && (
              <p className="text-center text-[14px] text-text-secondary py-4">
                All reviews loaded.
              </p>
            )}
          </div>
        )}
      </div>

      {/* HI-02: Delete confirmation dialog */}
      <DeleteDialog
        open={deleteTarget !== null}
        onClose={() => { if (!deleteMutation.isPending) setDeleteTarget(null) }}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget) }}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
