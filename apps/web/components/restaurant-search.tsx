'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, X } from 'lucide-react'

interface Restaurant {
  id: string
  name: string
  address?: string | null
}

interface RestaurantSearchProps {
  value: { id: string; name: string } | null
  onChange: (restaurant: { id: string; name: string } | null) => void
}

export function RestaurantSearch({ value, onChange }: RestaurantSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Restaurant[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const [manualCity, setManualCity] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setIsOpen(false)
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/v1/restaurants/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) {
        setError('Restaurant search unavailable. Add the name manually.')
        setResults([])
      } else {
        const data: Restaurant[] = await res.json()
        setResults(data)
      }
      setHasSearched(true)
      setIsOpen(true)
    } catch {
      setError('Restaurant search unavailable. Add the name manually.')
      setResults([])
      setHasSearched(true)
      setIsOpen(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query || query.length < 2) {
      setResults([])
      setIsOpen(false)
      setHasSearched(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      search(query)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    onChange({ id: restaurant.id, name: restaurant.name })
    setQuery('')
    setIsOpen(false)
  }

  const handleAddManually = async () => {
    if (!query.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: query.trim(),
          address: manualAddress.trim() || undefined,
          city: manualCity.trim() || undefined,
        }),
      })
      if (res.ok) {
        const restaurant: Restaurant = await res.json()
        onChange({ id: restaurant.id, name: restaurant.name })
        setQuery('')
        setIsOpen(false)
        setShowManualForm(false)
        setManualAddress('')
        setManualCity('')
      } else {
        setError('Could not save restaurant. Please try again.')
      }
    } catch {
      setError('Could not save restaurant. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
    setResults([])
    setIsOpen(false)
    setHasSearched(false)
  }

  // Show selected state
  if (value) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between h-[44px] px-3 bg-surface border border-border rounded-[8px]">
          <span className="text-[16px] text-text-primary truncate">{value.name}</span>
          <button
            type="button"
            aria-label="Clear restaurant selection"
            className="ml-2 text-text-secondary hover:text-text-primary transition-colors flex-shrink-0 focus:outline-none"
            onClick={handleClear}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  const showManually = hasSearched && results.length === 0 && query.length >= 2 && !error
  const showDropdown: boolean = isOpen && (results.length > 0 || showManually || !!error)

  return (
    <div ref={containerRef} className="w-full relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || showManually) setIsOpen(true)
          }}
          placeholder="Search for a restaurant..."
          aria-haspopup="listbox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          className="w-full h-[44px] px-3 pr-10 bg-surface border border-border rounded-[8px] text-[16px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          role="listbox"
          aria-label="Restaurant search results"
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-border rounded-[8px] shadow-[0_4px_12px_rgba(28,25,23,0.12)] overflow-hidden"
        >
          {error ? (
            <div className="px-3 py-3 text-[14px] text-destructive">
              {error}
            </div>
          ) : (
            <>
              {results.slice(0, 5).map((restaurant) => (
                <button
                  key={restaurant.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="w-full text-left px-3 py-2 min-h-[44px] flex flex-col justify-center hover:bg-[#FFE8CC] cursor-pointer transition-colors focus:outline-none focus:bg-[#FFE8CC]"
                  onClick={() => handleSelectRestaurant(restaurant)}
                >
                  <span className="text-[16px] text-text-primary">{restaurant.name}</span>
                  {restaurant.address && (
                    <span className="text-[14px] text-text-secondary">{restaurant.address}</span>
                  )}
                </button>
              ))}

              {showManually && !showManualForm && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 min-h-[44px] flex items-center text-[14px] text-accent hover:bg-[#FFE8CC] cursor-pointer transition-colors focus:outline-none"
                  onClick={() => setShowManualForm(true)}
                >
                  + Add &ldquo;{query}&rdquo; manually
                </button>
              )}

              {showManually && showManualForm && (
                <div className="px-3 py-3 flex flex-col gap-2">
                  <p className="text-[13px] font-medium text-text-primary">Adding &ldquo;{query}&rdquo;</p>
                  <input
                    type="text"
                    placeholder="Address (optional)"
                    value={manualAddress}
                    onChange={e => setManualAddress(e.target.value)}
                    className="w-full h-[36px] px-2.5 bg-bg border border-border rounded-md text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <input
                    type="text"
                    placeholder="City (optional)"
                    value={manualCity}
                    onChange={e => setManualCity(e.target.value)}
                    className="w-full h-[36px] px-2.5 bg-bg border border-border rounded-md text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <p className="text-[11px] text-text-secondary">Adding a city lets this restaurant appear on the map.</p>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={handleAddManually}
                      disabled={isLoading}
                      className="flex-1 h-[32px] bg-accent text-white text-[13px] font-medium rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Adding...' : 'Add restaurant'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualForm(false)}
                      className="px-3 h-[32px] text-[13px] text-text-secondary border border-border rounded-md hover:bg-bg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
