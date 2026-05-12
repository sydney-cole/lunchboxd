'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil, Trash2, MoreHorizontal, Heart, MapPin } from 'lucide-react'
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
    restaurant?: { name: string; address: string | null } | null
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
    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(28,25,23,0.06),0_1px_2px_rgba(28,25,23,0.04)] hover:shadow-[0_8px_24px_rgba(28,25,23,0.10),0_2px_6px_rgba(28,25,23,0.05)] hover:-translate-y-0.5 transition-all duration-200 group">
      {/* Photo */}
      {review.photoUrl && (
        <div className="w-full aspect-[16/9] overflow-hidden">
          <img
            src={review.photoUrl}
            alt="Meal photo"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      )}

      {/* Card body */}
      <div className="p-5">
        {/* Author row */}
        {showAuthor && review.author && (
          <a
            href={`/@${review.author.username}`}
            className="flex items-center gap-2.5 mb-4 group/author"
          >
            {review.author.avatarUrl ? (
              <img
                src={review.author.avatarUrl}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-white"
                alt=""
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                <span className="text-[12px] text-accent font-bold">
                  {review.author.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[13px] font-semibold text-text-primary group-hover/author:text-accent transition-colors duration-150 truncate">
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
            </div>
          </a>
        )}

        {/* Meal name + location + kebab menu */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-[family-name:--font-fraunces] text-[20px] font-semibold text-text-primary leading-tight truncate">
              {review.mealName || 'Untitled'}
            </h3>
            {locationLabel && (
              <span className="flex items-center gap-1 mt-1">
                <MapPin size={12} className="text-accent flex-shrink-0" />
                <span className="text-[13px] text-text-secondary truncate">{locationLabel}</span>
              </span>
            )}
          </div>

          {isOwnReview !== false && (
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="p-1.5 rounded-full text-text-tertiary hover:text-text-secondary hover:bg-surface-subtle transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Review actions"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={18} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-9 z-10 min-w-[152px] bg-surface border border-border rounded-xl shadow-[0_8px_24px_rgba(28,25,23,0.10),0_2px_6px_rgba(28,25,23,0.05)] py-1.5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onEdit(review.id) }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium text-text-primary hover:bg-surface-subtle transition-colors duration-150"
                  >
                    <Pencil size={15} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onDelete(review.id) }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium text-destructive hover:bg-red-50 transition-colors duration-150"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Star rating */}
        <div className="mb-3">
          <StarRating value={ratingValue} onChange={() => {}} readOnly size="sm" />
        </div>

        {/* Review body */}
        {review.body && (
          <div className="mb-3">
            <p
              ref={bodyRef}
              className={`text-[14px] text-text-secondary leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}
            >
              {review.body}
            </p>
            {(isClamped || expanded) && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-1 text-[13px] font-medium text-accent hover:text-accent-hover focus:outline-none"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Tags — pill style */}
        {review.tags && review.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {review.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-accent-subtle text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: date + like */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          {review.mealDate ? (
            <span className="text-[12px] text-text-tertiary">{formatMealDate(review.mealDate)}</span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => onLike(review.id)}
            className={`flex items-center gap-1.5 text-[13px] font-medium transition-colors duration-150 ${
              review.isLikedByMe
                ? 'text-destructive'
                : 'text-text-tertiary hover:text-destructive'
            }`}
            aria-label={review.isLikedByMe ? 'Unlike review' : 'Like review'}
          >
            <Heart
              size={15}
              className={review.isLikedByMe ? 'fill-destructive' : ''}
            />
            <span>{review.likeCount}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
