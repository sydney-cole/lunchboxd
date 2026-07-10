'use client'

import React, { useRef, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, UtensilsCrossed, Tag } from 'lucide-react'
import { ReviewCard } from '@/components/review-card'
import { FeedFilter, type FeedFilterValue } from '@/components/feed-filter'

interface TagReview {
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
  isOwnReview: boolean
  author: { username: string; avatarUrl: string | null } | null
}

interface TagReviewsPage {
  items: TagReview[]
  nextCursor: string | null
}

type InfiniteTagData = {
  pages: TagReviewsPage[]
  pageParams: (string | null)[]
}

function noop() {}

export default function TagPage() {
  const params = useParams()
  const label = decodeURIComponent(params.label as string)
  const queryClient = useQueryClient()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [mealType, setMealType] = useState<FeedFilterValue>('all')

  const queryKey = ['tag-reviews', label, mealType]

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<TagReviewsPage>({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' })
      if (pageParam) params.set('cursor', pageParam as string)
      if (mealType !== 'all') params.set('mealType', mealType)
      const res = await fetch(`/api/v1/tags/${encodeURIComponent(label)}/reviews?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load tagged reviews')
      return res.json() as Promise<TagReviewsPage>
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
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<InfiniteTagData>(queryKey)
      queryClient.setQueryData<InfiniteTagData>(queryKey, (old) => {
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
      if (context?.previousData) queryClient.setQueryData(queryKey, context.previousData)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const allReviews = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="w-full max-w-[600px] mx-auto">

        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-accent-subtle text-accent flex-shrink-0">
            <Tag size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] text-text-tertiary uppercase tracking-wide">Tagged</p>
            <h1 className="font-[family-name:--font-fraunces] text-[24px] font-bold text-text-primary leading-tight truncate">
              {label}
            </h1>
          </div>
        </div>

        {/* Meal-type filter */}
        <div className="flex justify-center mb-6">
          <FeedFilter value={mealType} onChange={setMealType} />
        </div>

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-text-tertiary" />
          </div>
        )}

        {isError && (
          <div className="text-center py-16">
            <p className="text-[15px] text-destructive">Something went wrong. Please try again.</p>
          </div>
        )}

        {!isLoading && !isError && allReviews.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4">
              <UtensilsCrossed size={24} strokeWidth={1.5} className="text-text-tertiary" />
            </div>
            <p className="font-[family-name:--font-fraunces] text-[18px] font-semibold text-text-primary mb-1.5">
              No {mealType === 'all' ? '' : `${mealType} `}reviews tagged &ldquo;{label}&rdquo;
            </p>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              {mealType === 'all'
                ? 'Be the first to tag a meal with this.'
                : 'Try a different filter.'}
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
                  author: review.author ?? undefined,
                }}
                showAuthor={true}
                isOwnReview={false}
                onEdit={noop}
                onDelete={noop}
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
    </div>
  )
}
