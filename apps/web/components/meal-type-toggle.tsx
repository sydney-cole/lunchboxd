'use client'

import React from 'react'

interface MealTypeToggleProps {
  value: 'restaurant' | 'homemade'
  onChange: (value: 'restaurant' | 'homemade') => void
}

export function MealTypeToggle({ value, onChange }: MealTypeToggleProps) {
  return (
    <div
      className="inline-flex p-1 rounded-full border border-border bg-surface-subtle"
      role="group"
      aria-label="Meal type"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'restaurant'}
        className={`flex-1 px-5 py-2 rounded-full text-[14px] font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 ${
          value === 'restaurant'
            ? 'bg-accent text-white shadow-[0_1px_3px_rgba(249,115,22,0.20)]'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        onClick={() => onChange('restaurant')}
      >
        Restaurant
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'homemade'}
        className={`flex-1 px-5 py-2 rounded-full text-[14px] font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 ${
          value === 'homemade'
            ? 'bg-accent text-white shadow-[0_1px_3px_rgba(249,115,22,0.20)]'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        onClick={() => onChange('homemade')}
      >
        Homemade
      </button>
    </div>
  )
}
