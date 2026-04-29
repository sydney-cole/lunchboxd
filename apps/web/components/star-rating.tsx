'use client'

import React, { useCallback, useRef } from 'react'

interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  readOnly?: boolean
  size?: 'sm' | 'md'
}

export function StarRating({ value, onChange, readOnly = false, size = 'md' }: StarRatingProps) {
  const starSize = size === 'md' ? 32 : 20
  const containerRef = useRef<HTMLDivElement>(null)

  const handleHalfClick = useCallback(
    (starIndex: number, isLeft: boolean) => {
      if (readOnly) return
      const newValue = isLeft ? starIndex - 0.5 : starIndex
      onChange(newValue)
    },
    [readOnly, onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (readOnly) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onChange(Math.max(0.5, value - 0.5))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onChange(Math.min(5, value + 0.5))
      }
    },
    [readOnly, value, onChange]
  )

  const renderStar = (starIndex: number) => {
    // starIndex is 1-based (1 to 5)
    const filled = value >= starIndex
    const halfFilled = !filled && value >= starIndex - 0.5

    const starId = `star-gradient-${starIndex}`

    return (
      <div
        key={starIndex}
        className="relative flex"
        style={{ width: starSize, height: starSize }}
      >
        {/* SVG star */}
        <svg
          width={starSize}
          height={starSize}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ pointerEvents: 'none' }}
        >
          {halfFilled && (
            <defs>
              <linearGradient id={starId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="50%" stopColor="#F97316" />
                <stop offset="50%" stopColor="#E7D5C5" />
              </linearGradient>
            </defs>
          )}
          <path
            d="M16 2.5L19.708 11.854L29.708 12.639L22.382 18.946L24.702 28.721L16 23.5L7.298 28.721L9.618 18.946L2.292 12.639L12.292 11.854L16 2.5Z"
            fill={
              filled
                ? '#F97316'
                : halfFilled
                ? `url(#${starId})`
                : '#E7D5C5'
            }
          />
        </svg>

        {/* Click zones — only when not readOnly */}
        {!readOnly && (
          <>
            {/* Left half: X.5 stars */}
            <button
              type="button"
              role="radio"
              aria-label={`${starIndex - 0.5} stars`}
              aria-checked={value === starIndex - 0.5}
              className="absolute inset-y-0 left-0 cursor-pointer focus:outline-none"
              style={{ width: '50%' }}
              onClick={() => handleHalfClick(starIndex, true)}
              tabIndex={-1}
            />
            {/* Right half: X.0 stars */}
            <button
              type="button"
              role="radio"
              aria-label={`${starIndex} stars`}
              aria-checked={value === starIndex}
              className="absolute inset-y-0 right-0 cursor-pointer focus:outline-none"
              style={{ width: '50%' }}
              onClick={() => handleHalfClick(starIndex, false)}
              tabIndex={-1}
            />
          </>
        )}
      </div>
    )
  }

  const stars = [1, 2, 3, 4, 5]

  if (readOnly) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1">
          {stars.map(renderStar)}
        </div>
        <span className="text-[14px] text-text-secondary">
          {value > 0 ? `${value} / 5` : '— / 5'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label={`Rating: ${value > 0 ? value : 'none'} out of 5 stars`}
        className="flex items-center gap-1 py-[6px]"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{ minHeight: '44px' }}
      >
        {stars.map(renderStar)}
      </div>
      <span className="text-[14px] text-text-secondary">
        {value > 0 ? `${value} / 5` : '— / 5'}
      </span>
    </div>
  )
}
