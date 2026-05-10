'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { StarRating } from '@/components/star-rating'
import { TagInput } from '@/components/tag-input'
import { RestaurantSearch } from '@/components/restaurant-search'
import { PhotoPicker } from '@/components/photo-picker'
import { MealTypeToggle } from '@/components/meal-type-toggle'
import type { CreateReviewInput } from '@lunchboxd/shared'

interface ReviewComposerProps {
  mode: 'create' | 'edit'
  initialData?: Partial<CreateReviewInput> & { id?: string; restaurantName?: string }
  onSuccess?: () => void
}

function getTodayDateString(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function ReviewComposer({ mode, initialData, onSuccess }: ReviewComposerProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [mealType, setMealType] = useState<'restaurant' | 'homemade'>(
    initialData?.mealType ?? 'restaurant'
  )
  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(
    initialData?.restaurantId
      ? { id: initialData.restaurantId, name: initialData.restaurantName ?? '' }
      : null
  )
  const [rating, setRating] = useState<number>(initialData?.rating ?? 0)
  const [note, setNote] = useState<string>(initialData?.note ?? '')
  // ME-04 / LO-05: photoKey always starts as null in both create and edit mode.
  // In edit mode, the existing photo URL is for display only (not sent unless changed).
  const [photoKey, setPhotoKey] = useState<string | null>(null)
  // Track whether user has explicitly changed the photo field
  const [photoChanged, setPhotoChanged] = useState(false)
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [mealDate, setMealDate] = useState<string>(
    initialData?.mealDate ?? getTodayDateString()
  )

  const [ratingError, setRatingError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const ratingRef = useRef<HTMLDivElement>(null)

  const handleMealTypeChange = (newType: 'restaurant' | 'homemade') => {
    setMealType(newType)
    if (newType === 'homemade') {
      setRestaurant(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    let hasError = false

    if (!rating || rating === 0) {
      setRatingError('Please add a rating.')
      ratingRef.current?.focus()
      hasError = true
    } else {
      setRatingError(null)
    }

    if (hasError) return

    setFormError(null)
    setIsSubmitting(true)

    // ME-04: In edit mode, only include photoKey in payload when the user has changed the photo.
    // Omitting photoKey from the PATCH payload means "no change to photo" (updateReviewSchema uses .partial()).
    // If photoChanged is true, include photoKey (may be null for "remove photo" or a key for "new photo").
    const payload: CreateReviewInput = {
      mealType,
      restaurantId: mealType === 'restaurant' && restaurant ? restaurant.id : null,
      rating,
      note: note.trim() || undefined,
      ...(mode === 'edit' ? (photoChanged ? { photoKey: photoKey || null } : {}) : { photoKey: photoKey || null }),
      tags,
      mealDate: mealDate || null,
    }

    try {
      const url =
        mode === 'edit' && initialData?.id
          ? `/api/v1/reviews/${initialData.id}`
          : '/api/v1/reviews'

      const method = mode === 'edit' ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Request failed')
      }

      await queryClient.invalidateQueries({ queryKey: ['my-reviews'] })

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/reviews')
      }
    } catch {
      setFormError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const noteCount = note.length
  const showNoteCounter = noteCount >= 1500

  return (
    <div className="w-full max-w-[600px] mx-auto bg-bg py-8 px-4">
      <h1 className="text-[20px] font-semibold text-text-primary mb-6">
        {mode === 'create' ? 'New Review' : 'Edit Review'}
      </h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-6">
          {/* Meal type toggle */}
          <div>
            <MealTypeToggle value={mealType} onChange={handleMealTypeChange} />
          </div>

          {/* Restaurant search — hidden when homemade */}
          {mealType === 'restaurant' && (
            <div>
              <label className="block text-[14px] text-text-secondary mb-1">
                Restaurant
              </label>
              <RestaurantSearch value={restaurant} onChange={setRestaurant} />
            </div>
          )}

          {/* Star rating */}
          <div>
            <label className="block text-[14px] text-text-secondary mb-1">
              Rating
            </label>
            <div ref={ratingRef} tabIndex={-1}>
              <StarRating value={rating} onChange={(v) => { setRating(v); setRatingError(null) }} />
            </div>
            {ratingError && (
              <p role="alert" className="mt-1 text-[14px] text-destructive">
                {ratingError}
              </p>
            )}
          </div>

          {/* Review note textarea */}
          <div>
            <label
              htmlFor="review-note"
              className="block text-[14px] text-text-secondary mb-1"
            >
              What did you think?
            </label>
            <textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Write your thoughts..."
              className="w-full px-3 py-2 bg-surface border border-border rounded-[8px] text-[16px] text-text-primary placeholder:text-text-secondary resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
            {showNoteCounter && (
              <p className="mt-1 text-[14px] text-text-secondary text-right">
                {noteCount} / 2000
              </p>
            )}
          </div>

          {/* Photo picker */}
          <div>
            <label className="block text-[14px] text-text-secondary mb-1">
              Photo
            </label>
            <PhotoPicker
              photoKey={photoKey}
              onPhotoChange={(key) => {
                setPhotoKey(key)
                setPhotoChanged(true)
              }}
            />
          </div>

          {/* Tag input */}
          <div>
            <label className="block text-[14px] text-text-secondary mb-1">
              Tags
            </label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          {/* Meal date */}
          <div>
            <label
              htmlFor="meal-date"
              className="block text-[14px] text-text-secondary mb-1"
            >
              Meal date
            </label>
            <input
              id="meal-date"
              type="date"
              value={mealDate}
              onChange={(e) => setMealDate(e.target.value)}
              className="w-full h-[44px] px-3 bg-surface border border-border rounded-[8px] text-[16px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Form-level error */}
          {formError && (
            <p role="alert" className="text-[14px] text-destructive text-center">
              {formError}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-[44px] bg-accent hover:bg-accent-hover active:bg-accent-active text-white text-[16px] font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>{mode === 'create' ? 'Post Review' : 'Save Changes'}</span>
              </>
            ) : (
              <span>{mode === 'create' ? 'Post Review' : 'Save Changes'}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
