'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UtensilsCrossed, Loader2 } from 'lucide-react'
import { ReviewCard } from '@/components/review-card'
import { FloatingActionButton } from '@/components/floating-action-button'
import { DeleteDialog } from '@/components/delete-dialog'

interface ReviewWithLike {
  id: string
  userId: string
  restaurantId: string | null
  mealType: 'restaurant' | 'homemade'
  mealName: string | null
  body: string | null
  rating: string | null
  photoUrl: string | null
  mealDate: string | null
  deletedAt: null
  createdAt: string
  updatedAt: string
  tags?: string[]
  restaurant?: { name: string; address: string | null } | null
  likeCount: number
  isLikedByMe: boolean
}

async function fetchMyReviews(): Promise<ReviewWithLike[]> {
  const res = await fetch('/api/v1/reviews')
  if (!res.ok) throw new Error('Failed to fetch reviews')
  return res.json()
}

async function deleteReview(id: string): Promise<void> {
  const res = await fetch(`/api/v1/reviews/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete review')
}

export default function ReviewsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const { data: reviews, isLoading, isError } = useQuery({
    queryKey: ['my-reviews'],
    queryFn: fetchMyReviews,
    staleTime: 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
      setDeleteTargetId(null)
    },
  })

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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['my-reviews'] })

      // Snapshot previous value
      const previousReviews = queryClient.getQueryData<ReviewWithLike[]>(['my-reviews'])

      // Optimistically update (per D-10: toggle instantly)
      queryClient.setQueryData<ReviewWithLike[]>(['my-reviews'], (old) =>
        old?.map(r =>
          r.id === reviewId
            ? {
                ...r,
                isLikedByMe: !r.isLikedByMe,
                likeCount: r.isLikedByMe ? r.likeCount - 1 : r.likeCount + 1,
              }
            : r
        )
      )

      return { previousReviews }
    },
    onError: (_err, _vars, context) => {
      // Roll back on error (per D-10: on error, roll back to previous state)
      if (context?.previousReviews) {
        queryClient.setQueryData(['my-reviews'], context.previousReviews)
      }
    },
    onSettled: () => {
      // Always refetch to sync server state
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
    },
  })

  const handleEdit = (id: string) => {
    router.push(`/reviews/${id}/edit`)
  }

  const handleDeleteRequest = (id: string) => {
    setDeleteTargetId(id)
  }

  const handleDeleteConfirm = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId)
    }
  }

  const handleDeleteClose = () => {
    if (!deleteMutation.isPending) {
      setDeleteTargetId(null)
    }
  }

  // Sort reviews reverse chronological
  const sortedReviews = reviews
    ? [...reviews].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : []

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="w-full max-w-[600px] mx-auto">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-6">
          <h1 className="text-[20px] font-semibold text-text-primary">My Reviews</h1>
          {reviews && reviews.length > 0 && (
            <span className="text-[16px] text-text-secondary">({reviews.length})</span>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-text-secondary" />
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="text-center py-16">
            <p className="text-[16px] text-destructive">
              Something went wrong. Please try again.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && sortedReviews.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UtensilsCrossed size={48} className="text-text-secondary mb-4" />
            <h2 className="text-[20px] font-semibold text-text-primary mb-2">
              No reviews yet
            </h2>
            <p className="text-[16px] text-text-secondary">
              Tap + to log your first meal.
            </p>
          </div>
        )}

        {/* Reviews list */}
        {!isLoading && !isError && sortedReviews.length > 0 && (
          <div className="flex flex-col gap-6">
            {sortedReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
                onLike={(id) => likeMutation.mutate({ reviewId: id })}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <FloatingActionButton href="/reviews/new" />

      {/* Delete confirmation dialog */}
      <DeleteDialog
        open={deleteTargetId !== null}
        onClose={handleDeleteClose}
        onConfirm={handleDeleteConfirm}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
