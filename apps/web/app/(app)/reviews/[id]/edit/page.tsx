'use client'

import React, { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { ReviewComposer } from '@/components/review-composer'
import { DeleteDialog } from '@/components/delete-dialog'

interface Review {
  id: string
  userId: string
  restaurantId: string | null
  mealType: 'restaurant' | 'homemade'
  body: string | null
  rating: string | null
  photoUrl: string | null
  mealDate: string | null
  deletedAt: null
  createdAt: string
  updatedAt: string
  tags?: string[]
  restaurant?: { name: string; address: string | null } | null
}

async function fetchAllReviews(): Promise<Review[]> {
  const res = await fetch('/api/v1/reviews')
  if (!res.ok) throw new Error('Failed to fetch reviews')
  return res.json()
}

async function deleteReview(id: string): Promise<void> {
  const res = await fetch(`/api/v1/reviews/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete review')
}

export default function EditReviewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data: review, isLoading, isError } = useQuery({
    queryKey: ['review', id],
    queryFn: async () => {
      const reviews = await fetchAllReviews()
      return reviews.find((r) => r.id === id) ?? null
    },
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
      router.push('/reviews')
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-text-secondary" />
      </div>
    )
  }

  if (isError || !review) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <p className="text-[16px] text-destructive text-center">
          Review not found. It may have been deleted.
        </p>
      </div>
    )
  }

  const initialData = {
    id: review.id,
    mealType: review.mealType,
    restaurantId: review.restaurantId ?? undefined,
    rating: review.rating ? parseFloat(review.rating) : 0,
    note: review.body ?? '',
    photoKey: review.photoUrl ?? null,
    tags: review.tags ?? [],
    mealDate: review.mealDate ?? undefined,
  }

  return (
    <div className="min-h-screen bg-bg">
      <ReviewComposer
        mode="edit"
        initialData={initialData}
        onSuccess={() => router.push('/reviews')}
      />

      {/* Delete review text button */}
      <div className="w-full max-w-[600px] mx-auto px-4 pb-8 flex justify-end">
        <button
          type="button"
          onClick={() => setDeleteDialogOpen(true)}
          className="text-[14px] font-semibold text-destructive hover:underline focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 rounded"
        >
          Delete review
        </button>
      </div>

      <DeleteDialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteDialogOpen(false)
        }}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
