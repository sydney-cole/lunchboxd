'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Loader2, UtensilsCrossed } from 'lucide-react'
import { ReviewCard } from '@/components/review-card'
import { FollowButton } from '@/components/follow-button'
import { DeleteDialog } from '@/components/delete-dialog'

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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

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
        <Loader2 size={28} className="animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (profileError || profile == null) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center px-4">
          <p className="font-[family-name:--font-fraunces] text-[22px] font-semibold text-text-primary mb-2">
            Profile not found
          </p>
          <p className="text-[15px] text-text-secondary">
            This account doesn&apos;t exist or may have been removed.
          </p>
        </div>
      </div>
    )
  }

  const { user, stats, isOwner, followState } = profile
  const allReviews = reviewsData?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="w-full max-w-[600px] mx-auto">

        {/* Profile header card */}
        <div className="bg-surface border border-border rounded-2xl p-7 mb-6 shadow-[0_2px_8px_rgba(28,25,23,0.06),0_1px_2px_rgba(28,25,23,0.04)]">
          <div className="flex flex-col items-center">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-accent/15 flex items-center justify-center overflow-hidden mb-4 ring-4 ring-white shadow-[0_2px_12px_rgba(28,25,23,0.10)]">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={`${user.username}'s avatar`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[32px] font-bold text-accent" aria-hidden="true">
                  {user.username[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="font-[family-name:--font-fraunces] text-[24px] font-bold text-text-primary leading-tight">
              {user.displayName ?? user.username}
            </h1>
            <p className="text-[14px] text-text-secondary mt-0.5">@{user.username}</p>

            {/* Bio */}
            {user.bio && (
              <p className="text-[15px] text-text-primary leading-relaxed mt-3 text-center max-w-[360px]">
                {user.bio}
              </p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-6 mt-5 mb-5">
              <a
                href={`/@${user.username}/followers`}
                className="flex flex-col items-center hover:text-accent transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent rounded"
              >
                <span className="text-[18px] font-bold text-text-primary">{stats.followerCount}</span>
                <span className="text-[12px] text-text-secondary">followers</span>
              </a>
              <div className="w-px h-8 bg-border" />
              <a
                href={`/@${user.username}/following`}
                className="flex flex-col items-center hover:text-accent transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent rounded"
              >
                <span className="text-[18px] font-bold text-text-primary">{stats.followingCount}</span>
                <span className="text-[12px] text-text-secondary">following</span>
              </a>
              <div className="w-px h-8 bg-border" />
              <div className="flex flex-col items-center">
                <span className="text-[18px] font-bold text-text-primary">{stats.reviewCount}</span>
                <span className="text-[12px] text-text-secondary">reviews</span>
              </div>
            </div>

            {/* CTA */}
            {isOwner ? (
              <Link
                href="/profile/edit"
                className="px-6 py-2.5 rounded-full border border-border-strong text-text-primary text-[14px] font-semibold hover:border-accent hover:text-accent transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                Edit profile
              </Link>
            ) : (
              <FollowButton targetUserId={user.id} initialState={followState ?? 'none'} />
            )}
          </div>
        </div>

        {/* Reviews section */}
        <h2 className="font-[family-name:--font-fraunces] text-[22px] font-bold text-text-primary mb-5">
          Reviews
        </h2>

        {reviewsLoading && (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-text-tertiary" />
          </div>
        )}

        {!reviewsLoading && allReviews.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4">
              <UtensilsCrossed size={24} strokeWidth={1.5} className="text-text-tertiary" />
            </div>
            <p className="font-[family-name:--font-fraunces] text-[18px] font-semibold text-text-primary mb-1.5">
              No reviews yet
            </p>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              {isOwner
                ? 'Post your first meal to see it here.'
                : `${user.username} hasn't posted any reviews.`}
            </p>
          </div>
        )}

        {allReviews.length > 0 && (
          <div className="flex flex-col gap-5">
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
              <div className="flex justify-center py-5">
                <Loader2 size={20} className="animate-spin text-text-tertiary" />
              </div>
            )}
            {!hasNextPage && allReviews.length > 0 && (
              <p className="text-center text-[13px] text-text-tertiary py-5">
                All reviews loaded
              </p>
            )}
          </div>
        )}
      </div>

      <DeleteDialog
        open={deleteTarget !== null}
        onClose={() => { if (!deleteMutation.isPending) setDeleteTarget(null) }}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget) }}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
