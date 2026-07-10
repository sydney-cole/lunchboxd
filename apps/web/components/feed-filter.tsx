'use client'

import React from 'react'

export type FeedFilterValue = 'all' | 'restaurant' | 'homemade'

const OPTIONS: { value: FeedFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'homemade', label: 'Homemade' },
]

interface FeedFilterProps {
  value: FeedFilterValue
  onChange: (value: FeedFilterValue) => void
}

export function FeedFilter({ value, onChange }: FeedFilterProps) {
  return (
    <div
      className="inline-flex p-1 rounded-full border border-border bg-surface-subtle"
      role="group"
      aria-label="Filter feed by meal type"
    >
      {OPTIONS.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={`px-5 py-2 rounded-full text-[14px] font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 ${
              isActive
                ? 'bg-accent text-white shadow-[0_1px_3px_rgba(249,115,22,0.20)]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
