'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, MapPin, UtensilsCrossed, ArrowLeft } from 'lucide-react'
import { ReviewCard } from '@/components/review-card'
import { DeleteDialog } from '@/components/delete-dialog'
import { StarRating } from '@/components/star-rating'

interface RestaurantReview {
  id: string
  mealName: string | null
  body: string | null
  rating: string | null
  photoUrl: string | null
  mealType: string
  mealDate: string | null
  createdAt: string
  tags: string[]
  likeCount: number
  isLikedByMe: boolean
  isOwnReview: boolean
  author: { id: string; username: string; avatarUrl: string | null } | null
}

interface RestaurantProfile {
  restaurant: {
    id: string
    name: string
    address: string | null
    city: string | null
  }
  reviews: RestaurantReview[]
  avgRating: string | null
  reviewCount: number
}

type SortOption = 'recent' | 'high' | 'low'

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Recent',
  high: 'High to Low',
  low: 'Low to High',
}

export default function RestaurantProfilePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const queryClient = useQueryClient()
  const [sort, setSort] = useState<SortOption>('recent')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['restaurant-profile', id, sort],
    queryFn: async () => {
      const res = await fetch(`/api/v1/restaurants/${id}?sort=${sort}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to load restaurant')
      return res.json() as Promise<RestaurantProfile>
    },
    staleTime: 60_000,
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
      await queryClient.cancelQueries({ queryKey: ['restaurant-profile', id, sort] })
      const prev = queryClient.getQueryData<RestaurantProfile>(['restaurant-profile', id, sort])
      queryClient.setQueryData<RestaurantProfile>(['restaurant-profile', id, sort], (old) => {
        if (!old) return old
        return {
          ...old,
          reviews: old.reviews.map((r) =>
            r.id === reviewId
              ? {
                  ...r,
                  isLikedByMe: !r.isLikedByMe,
                  likeCount: r.isLikedByMe ? r.likeCount - 1 : r.likeCount + 1,
                }
              : r
          ),
        }
      })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['restaurant-profile', id, sort], context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-profile', id, sort] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const res = await fetch(`/api/v1/reviews/${reviewId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['restaurant-profile', id] })
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center px-4">
          <p className="font-[family-name:--font-fraunces] text-[22px] font-semibold text-text-primary mb-2">
            Restaurant not found
          </p>
          <p className="text-[15px] text-text-secondary">
            This restaurant doesn&apos;t exist or hasn&apos;t been reviewed yet.
          </p>
        </div>
      </div>
    )
  }

  const { restaurant, reviews, avgRating, reviewCount } = data

  const locationLine = [restaurant.address, restaurant.city].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="w-full max-w-[600px] mx-auto">

        {/* Back */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-accent transition-colors duration-150 mb-5 focus:outline-none"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {/* Restaurant header */}
        <div className="bg-surface border border-border rounded-2xl p-6 mb-6 shadow-[0_2px_8px_rgba(28,25,23,0.06),0_1px_2px_rgba(28,25,23,0.04)]">
          <h1 className="font-[family-name:--font-fraunces] text-[26px] font-bold text-text-primary leading-tight mb-1">
            {restaurant.name}
          </h1>

          {locationLine && (
            <div className="flex items-center gap-1.5 mb-4">
              <MapPin size={13} className="text-accent flex-shrink-0" />
              <span className="text-[13px] text-text-secondary">{locationLine}</span>
            </div>
          )}

          <div className="flex items-center gap-5">
            {avgRating !== null ? (
              <div className="flex items-center gap-2">
                <StarRating
                  value={parseFloat(avgRating)}
                  onChange={() => {}}
                  readOnly
                  size="sm"
                  showLabel={false}
                />
                <span className="text-[14px] font-semibold text-text-primary">{avgRating}</span>
              </div>
            ) : (
              <span className="text-[13px] text-text-tertiary">No rating yet</span>
            )}

            <div className="w-px h-5 bg-border" />

            <span className="text-[13px] text-text-secondary">
              <span className="font-semibold text-text-primary">{reviewCount}</span>{' '}
              {reviewCount === 1 ? 'review' : 'reviews'}
            </span>
          </div>
        </div>

        {/* Sort controls */}
        {reviewCount > 0 && (
          <div className="flex items-center gap-2 mb-5">
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSort(option)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent ${
                  sort === option
                    ? 'bg-accent text-white shadow-[0_1px_3px_rgba(249,115,22,0.25)]'
                    : 'bg-surface border border-border text-text-secondary hover:border-accent hover:text-accent'
                }`}
              >
                {SORT_LABELS[option]}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {reviewCount === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4">
              <UtensilsCrossed size={24} strokeWidth={1.5} className="text-text-tertiary" />
            </div>
            <p className="font-[family-name:--font-fraunces] text-[18px] font-semibold text-text-primary mb-1.5">
              No reviews yet
            </p>
            <p className="text-[14px] text-text-secondary">
              Be the first to review a dish here.
            </p>
          </div>
        )}

        {/* Reviews list */}
        {reviews.length > 0 && (
          <div className="flex flex-col gap-5">
            {reviews.map((review) => (
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
                  restaurant: null,
                  likeCount: review.likeCount,
                  isLikedByMe: review.isLikedByMe,
                  author: review.author ?? undefined,
                }}
                showAuthor={true}
                isOwnReview={review.isOwnReview}
                onEdit={(reviewId) => router.push(`/reviews/${reviewId}/edit`)}
                onDelete={(reviewId) => setDeleteTarget(reviewId)}
                onLike={(reviewId) => likeMutation.mutate({ reviewId })}
              />
            ))}
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
