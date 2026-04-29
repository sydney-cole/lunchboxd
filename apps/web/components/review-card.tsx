'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { StarRating } from '@/components/star-rating'

interface ReviewCardProps {
  review: {
    id: string
    body: string | null
    rating: string | null
    photoUrl: string | null
    mealType: string
    mealDate: string | null
    restaurant?: { name: string; address: string | null } | null
    tags?: string[]
  }
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function formatMealDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ReviewCard({ review, onEdit, onDelete }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isClamped, setIsClamped] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLParagraphElement>(null)

  // Detect whether the body text is actually clamped (overflow hidden)
  const checkClamped = useCallback(() => {
    const el = bodyRef.current
    if (el) setIsClamped(el.scrollHeight > el.clientHeight)
  }, [])

  useEffect(() => {
    checkClamped()
  }, [checkClamped])

  const ratingValue = review.rating ? parseFloat(review.rating) : 0

  // Close menu on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [menuOpen])

  const restaurantName =
    review.mealType === 'homemade'
      ? 'Homemade'
      : review.restaurant?.name ?? 'Unknown Restaurant'

  return (
    <div
      className="bg-surface border border-border rounded-[12px] shadow-[0_1px_4px_0_rgba(28,25,23,0.08)] overflow-hidden hover:border-accent transition-colors"
    >
      {/* Photo thumbnail */}
      {review.photoUrl && (
        <div className="w-full h-[160px] overflow-hidden">
          <img
            src={review.photoUrl}
            alt="Meal photo"
            className="w-full h-full object-cover rounded-t-[12px]"
          />
        </div>
      )}

      {/* Card body */}
      <div className="p-4">
        {/* Header row: restaurant name + kebab menu */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[16px] font-semibold text-text-primary truncate">
              {restaurantName}
            </span>
          </div>

          {/* Kebab menu */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Review actions"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal size={20} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-10 min-w-[140px] bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(28,25,23,0.12)] py-1">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onEdit(review.id) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[14px] text-text-primary hover:bg-bg transition-colors"
                >
                  <Pencil size={16} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onDelete(review.id) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[14px] text-destructive hover:bg-bg transition-colors"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Star rating */}
        <div className="mb-3">
          <StarRating
            value={ratingValue}
            onChange={() => {}}
            readOnly
            size="sm"
          />
        </div>

        {/* Review note with line-clamp */}
        {review.body && (
          <div className="mb-3">
            <p
              ref={bodyRef}
              className={`text-[14px] text-text-primary leading-[1.5] ${
                !expanded ? 'line-clamp-3' : ''
              }`}
            >
              {review.body}
            </p>
            {/* Show more / less toggle — only when text is actually clamped or expanded */}
            {(isClamped || expanded) && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-1 text-[14px] text-accent hover:underline focus:outline-none"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Tags */}
        {review.tags && review.tags.length > 0 && (
          <p className="text-[14px] text-text-secondary mb-3">
            {review.tags.join(', ')}
          </p>
        )}

        {/* Meal date */}
        {review.mealDate && (
          <p className="text-[14px] text-text-secondary">
            {formatMealDate(review.mealDate)}
          </p>
        )}
      </div>
    </div>
  )
}
