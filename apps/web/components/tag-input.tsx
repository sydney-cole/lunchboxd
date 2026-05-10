'use client'

import React, { useState, useRef } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commitTag = (raw: string) => {
    // LO-01: Normalize to lowercase before deduplication — matches server-side normalization
    const trimmed = raw.trim().toLowerCase()
    if (!trimmed) return
    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTag(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      // Remove last tag on backspace when input is empty
      onChange(tags.slice(0, -1))
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // If user types a comma, commit the part before the comma
    if (val.endsWith(',')) {
      commitTag(val.slice(0, -1))
    } else {
      setInputValue(val)
    }
  }

  const removeTag = (index: number) => {
    const updated = [...tags]
    updated.splice(index, 1)
    onChange(updated)
  }

  return (
    <div
      className="w-full cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="inline-flex items-center gap-1 bg-surface border border-border rounded-[4px] text-[14px] text-text-primary px-2 py-1"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                className="text-text-secondary hover:text-destructive transition-colors focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(i)
                }}
              >
                <X size={16} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Add a tag (e.g. comfort food, date night)"
        className="w-full h-[44px] px-3 bg-surface border border-border rounded-[8px] text-[16px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
      />
    </div>
  )
}
