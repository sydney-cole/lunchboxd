'use client'

import React, { useRef, useEffect } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, UtensilsCrossed } from 'lucide-react'
import { ReviewCard } from '@/components/review-card'
import { FloatingActionButton } from '@/components/floating-action-button'

interface FeedAuthor {
  id: string
  username: string
  avatarUrl: string | null
}

interface FeedItem {
  id: string
  body: string | null
  rating: string | null
  photoUrl: string | null
  mealType: string
  mealDate: string | null
  createdAt: string
  feedCreatedAt: string
  tags: string[]
  restaurant: { id: string; name: string; address: string | null } | null
  likeCount: number
  isLikedByMe: boolean
  author: FeedAuthor | null
  isOwnReview: boolean
}

interface FeedResponse {
  items: FeedItem[]
  nextCursor: string | null
}

type InfiniteFeedData = {
  pages: FeedResponse[]
  pageParams: (string | null)[]
}

export default function FeedPage() {
  const queryClient = useQueryClient()
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<FeedResponse>({
    queryKey: ['feed'],
    queryFn: async ({ pageParam }) => {
      const url = pageParam
        ? `/api/v1/feed?cursor=${encodeURIComponent(pageParam as string)}&limit=20`
        : '/api/v1/feed'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load feed')
      return res.json() as Promise<FeedResponse>
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  })

  // IntersectionObserver sentinel — triggers fetchNextPage when bottom div enters viewport
  // Per D-06: infinite scroll only, no "Load more" button
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
    return () => {
      if (el) observer.unobserve(el)
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Feed like mutation — targets ['feed'] query key, NOT ['my-reviews']
  // Per RESEARCH.md Pitfall 3: separate cache entry from my-reviews
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
      await queryClient.cancelQueries({ queryKey: ['feed'] })
      const previousData = queryClient.getQueryData<InfiniteFeedData>(['feed'])
      queryClient.setQueryData<InfiniteFeedData>(['feed'], (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === reviewId
                ? {
                    ...item,
                    isLikedByMe: !item.isLikedByMe,
                    likeCount: item.isLikedByMe ? item.likeCount - 1 : item.likeCount + 1,
                  }
                : item
            ),
          })),
        }
      })
      return { previousData }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['feed'], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  const allItems = data?.pages.flatMap((page) => page.items) ?? []

  // Loading state (initial load)
  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-text-secondary" />
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-[20px] font-semibold text-text-primary mb-2">Couldn&apos;t load your feed</p>
          <p className="text-[15px] text-text-secondary">Something went wrong. Refresh the page to try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-bg">
      <div className="w-full max-w-[640px] mx-auto px-4 py-10">
        <h1 className="font-[family-name:--font-fraunces] text-[32px] text-text-primary mb-8 text-center">Feed</h1>

        {/* Empty state */}
        {allItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <UtensilsCrossed size={36} strokeWidth={1.5} className="text-border mb-5" />
            <h2 className="text-[18px] font-semibold text-text-primary mb-1.5">Nothing here yet</h2>
            <p className="text-[14px] text-text-secondary mb-7 max-w-[220px] leading-relaxed">
              Follow people to see what they&apos;re eating.
            </p>
            <a
              href="/search"
              className="inline-flex items-center bg-accent text-white text-[13px] font-semibold px-5 py-2 rounded-full hover:bg-accent-hover transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 tracking-wide"
            >
              Find people to follow
            </a>
          </div>
        )}

        {/* Feed list */}
        {allItems.length > 0 && (
          <div className="flex flex-col gap-6">
            {allItems.map((item) => (
              <ReviewCard
                key={item.id}
                review={{
                  id: item.id,
                  body: item.body,
                  rating: item.rating,
                  photoUrl: item.photoUrl,
                  mealType: item.mealType,
                  mealDate: item.mealDate,
                  createdAt: item.createdAt,
                  tags: item.tags,
                  restaurant: item.restaurant,
                  likeCount: item.likeCount,
                  isLikedByMe: item.isLikedByMe,
                  author: item.author ?? undefined,
                }}
                showAuthor={true}
                isOwnReview={item.isOwnReview}
                onEdit={() => {}}
                onDelete={() => {}}
                onLike={(id) => likeMutation.mutate({ reviewId: id })}
              />
            ))}

            {/* Infinite scroll sentinel — invisible div; IntersectionObserver triggers fetchNextPage */}
            <div ref={sentinelRef} />

            {/* Footer: loading spinner or end-of-feed indicator */}
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-text-secondary" />
              </div>
            )}
            {!hasNextPage && allItems.length > 0 && (
              <p className="text-center text-[14px] text-text-secondary py-4">
                You&apos;re all caught up.
              </p>
            )}
          </div>
        )}
      </div>

      {/* FAB — same as reviews page */}
      <FloatingActionButton href="/reviews/new" />
    </div>
  )
}
