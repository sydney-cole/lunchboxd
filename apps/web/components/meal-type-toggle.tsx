'use client'

import React from 'react'

interface MealTypeToggleProps {
  value: 'restaurant' | 'homemade'
  onChange: (value: 'restaurant' | 'homemade') => void
}

export function MealTypeToggle({ value, onChange }: MealTypeToggleProps) {
  return (
    <div
      className="flex w-full h-[44px] rounded-[12px] overflow-hidden border border-border bg-surface"
      role="group"
      aria-label="Meal type"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'restaurant'}
        className={`flex-1 flex items-center justify-center text-[16px] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent ${
          value === 'restaurant'
            ? 'bg-accent text-white font-semibold'
            : 'bg-surface text-text-primary font-normal hover:bg-[#FFE8CC]'
        }`}
        onClick={() => onChange('restaurant')}
      >
        Restaurant
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'homemade'}
        className={`flex-1 flex items-center justify-center text-[16px] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent ${
          value === 'homemade'
            ? 'bg-accent text-white font-semibold'
            : 'bg-surface text-text-primary font-normal hover:bg-[#FFE8CC]'
        }`}
        onClick={() => onChange('homemade')}
      >
        Homemade
      </button>
    </div>
  )
}
