'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil, Trash2, MoreHorizontal, Heart, MapPin, UtensilsCrossed } from 'lucide-react'
import { StarRating } from '@/components/star-rating'
import { formatRelativeTime } from '@/lib/utils'

interface ReviewCardProps {
  review: {
    id: string
    mealName: string | null
    body: string | null
    rating: string | null
    photoUrl: string | null
    mealType: string
    mealDate: string | null
    createdAt?: string | Date
    restaurant?: { id?: string; name: string; address: string | null } | null
    tags?: string[]
    likeCount: number
    isLikedByMe: boolean
    author?: {
      username: string
      avatarUrl: string | null
    } | null
  }
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onLike: (id: string) => void
  showAuthor?: boolean
  isOwnReview?: boolean
}

function formatMealDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ReviewCard({ review, onEdit, onDelete, onLike, showAuthor, isOwnReview }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isClamped, setIsClamped] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLParagraphElement>(null)

  const checkClamped = useCallback(() => {
    const el = bodyRef.current
    if (el) setIsClamped(el.scrollHeight > el.clientHeight)
  }, [])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    checkClamped()
    const ro = new ResizeObserver(() => checkClamped())
    ro.observe(el)
    return () => ro.disconnect()
  }, [checkClamped])

  const ratingValue = review.rating ? parseFloat(review.rating) : 0

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

  const locationLabel =
    review.mealType === 'homemade'
      ? 'Homemade'
      : [review.restaurant?.name, review.restaurant?.address]
          .filter(Boolean)
          .join(' · ')

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(28,25,23,0.06),0_1px_2px_rgba(28,25,23,0.04)] hover:shadow-[0_8px_24px_rgba(28,25,23,0.10),0_2px_6px_rgba(28,25,23,0.05)] hover:-translate-y-0.5 transition-all duration-200 group flex">

      {/* Left: Square image */}
      <div className="relative w-[116px] sm:w-[148px] flex-shrink-0 self-stretch bg-surface-subtle">
        {review.photoUrl && !photoError ? (
          <img
            src={review.photoUrl}
            alt="Meal photo"
            className="absolute inset-0 w-full h-full object-contain"
            onError={() => setPhotoError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <UtensilsCrossed size={28} strokeWidth={1.5} className="text-accent/30" />
          </div>
        )}
      </div>

      {/* Right: Content */}
      <div className="flex-1 p-4 flex flex-col min-w-0">

        {/* Author row */}
        {showAuthor && review.author && (
          <a
            href={`/@${review.author.username}`}
            className="flex items-center gap-2 mb-2.5 group/author"
          >
            {review.author.avatarUrl ? (
              <img
                src={review.author.avatarUrl}
                className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                alt=""
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-accent font-bold">
                  {review.author.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-[12px] font-semibold text-text-secondary group-hover/author:text-accent transition-colors duration-150 truncate">
              @{review.author.username}
            </span>
            {review.createdAt && (
              <span className="text-[12px] text-text-tertiary flex-shrink-0">
                · {formatRelativeTime(
                  typeof review.createdAt === 'string'
                    ? review.createdAt
                    : (review.createdAt as Date).toISOString()
                )}
              </span>
            )}
          </a>
        )}

        {/* Meal name + kebab */}
        <div className="flex items-start justify-between gap-1.5 mb-1">
          <h3 className="font-[family-name:--font-fraunces] text-[17px] font-semibold text-text-primary leading-snug">
            {review.mealName || 'Untitled'}
          </h3>

          {isOwnReview !== false && (
            <div className="relative flex-shrink-0 -mt-0.5" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="p-1 rounded-full text-text-tertiary hover:text-text-secondary hover:bg-surface-subtle transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Review actions"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={16} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-8 z-10 min-w-[144px] bg-surface border border-border rounded-xl shadow-[0_8px_24px_rgba(28,25,23,0.10)] py-1.5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onEdit(review.id) }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-subtle transition-colors duration-150"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onDelete(review.id) }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] font-medium text-destructive hover:bg-red-50 transition-colors duration-150"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Location */}
        {locationLabel && (
          <span className="flex items-center gap-1 mb-2">
            <MapPin size={11} className="text-accent flex-shrink-0" />
            {review.restaurant?.id ? (
              <a
                href={`/restaurants/${review.restaurant.id}`}
                className="text-[12px] text-text-secondary truncate hover:text-accent transition-colors duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {locationLabel}
              </a>
            ) : (
              <span className="text-[12px] text-text-secondary truncate">{locationLabel}</span>
            )}
          </span>
        )}

        {/* Stars */}
        <div className="mb-2">
          <StarRating value={ratingValue} onChange={() => {}} readOnly size="sm" showLabel={false} />
        </div>

        {/* Body text */}
        {review.body && (
          <div className="mb-2">
            <p
              ref={bodyRef}
              className={`text-[13px] text-text-secondary leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}
            >
              {review.body}
            </p>
            {(isClamped || expanded) && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="text-[12px] font-medium text-accent hover:text-accent-hover focus:outline-none"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Tags */}
        {review.tags && review.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {review.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent-subtle text-accent"
              >
                {tag}
              </span>
            ))}
            {review.tags.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-text-tertiary">
                +{review.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Spacer pushes footer to bottom */}
        <div className="flex-1" />

        {/* Footer: date + like */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border mt-2">
          {review.mealDate ? (
            <span className="text-[11px] text-text-tertiary">{formatMealDate(review.mealDate)}</span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => onLike(review.id)}
            className={`flex items-center gap-1 text-[12px] font-medium transition-colors duration-150 ${
              review.isLikedByMe
                ? 'text-destructive'
                : 'text-text-tertiary hover:text-destructive'
            }`}
            aria-label={review.isLikedByMe ? 'Unlike review' : 'Like review'}
          >
            <Heart size={13} className={review.isLikedByMe ? 'fill-destructive' : ''} />
            <span>{review.likeCount}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
