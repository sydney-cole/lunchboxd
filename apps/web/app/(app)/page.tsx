'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, UtensilsCrossed } from 'lucide-react'
import { ReviewCard } from '@/components/review-card'
import { FloatingActionButton } from '@/components/floating-action-button'
import { DeleteDialog } from '@/components/delete-dialog'

interface FeedAuthor {
  id: string
  username: string
  avatarUrl: string | null
}

interface FeedItem {
  id: string
  mealName: string | null
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
  const router = useRouter()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

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

  const deleteMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const res = await fetch(`/api/v1/reviews/${reviewId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  const allItems = data?.pages.flatMap((page) => page.items) ?? []

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-bg flex items-center justify-center">
        <div className="text-center px-4">
          <p className="font-[family-name:--font-fraunces] text-[22px] font-semibold text-text-primary mb-2">
            Couldn&apos;t load your feed
          </p>
          <p className="text-[15px] text-text-secondary">
            Something went wrong. Refresh the page to try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-bg">
      <div className="w-full max-w-[640px] mx-auto px-4 py-10">
        <h1 className="font-[family-name:--font-fraunces] text-[36px] font-bold text-text-primary mb-8 tracking-tight">
          Feed
        </h1>

        {/* Empty state */}
        {allItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-subtle border border-border flex items-center justify-center mb-5">
              <UtensilsCrossed size={28} strokeWidth={1.5} className="text-text-tertiary" />
            </div>
            <h2 className="font-[family-name:--font-fraunces] text-[20px] font-semibold text-text-primary mb-2">
              Nothing here yet
            </h2>
            <p className="text-[14px] text-text-secondary mb-7 max-w-[220px] leading-relaxed">
              Follow people to see what they&apos;re eating.
            </p>
            <a
              href="/search"
              className="inline-flex items-center bg-accent text-white text-[14px] font-semibold px-6 py-2.5 rounded-full hover:bg-accent-hover transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 shadow-[0_1px_3px_rgba(249,115,22,0.20)]"
            >
              Find people to follow
            </a>
          </div>
        )}

        {/* Feed list */}
        {allItems.length > 0 && (
          <div className="flex flex-col gap-5">
            {allItems.map((item) => (
              <ReviewCard
                key={item.id}
                review={{
                  id: item.id,
                  mealName: item.mealName,
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
            {!hasNextPage && allItems.length > 0 && (
              <p className="text-center text-[13px] text-text-tertiary py-5">
                You&apos;re all caught up
              </p>
            )}
          </div>
        )}
      </div>

      <FloatingActionButton href="/reviews/new" />

      <DeleteDialog
        open={deleteTarget !== null}
        onClose={() => { if (!deleteMutation.isPending) setDeleteTarget(null) }}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget) }}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
