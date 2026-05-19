'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps'
import { Loader2, MapPin as MapPinIcon } from 'lucide-react'

interface MapPin {
  id: string
  name: string
  lat: string   // string — Drizzle numeric returns string; parseFloat() before use in coordinates
  lng: string
  reviewedByFollowed: boolean
}

interface ReviewedRestaurant {
  id: string
  name: string
  city: string | null
  address: string | null
  lat: string | null
  lng: string | null
  reviewedByFollowed: boolean
}

const NYC_FALLBACK = { lat: 40.7128, lng: -74.006 }

export default function MapPage() {
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)

  // Set document title (can't use metadata export in 'use client' page)
  useEffect(() => {
    document.title = 'Map · Lunchboxd'
  }, [])

  // Request geolocation on mount; fall back to NYC if denied or unsupported
  useEffect(() => {
    if (!navigator.geolocation) {
      setMapCenter(NYC_FALLBACK)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMapCenter(NYC_FALLBACK),
      { timeout: 8000 }
    )
  }, [])

  // 300ms debounce on search input — same pattern as Phase 3 SearchPage
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 300)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Map pins — full dataset, no pagination (coordinates-bearing restaurants only)
  const { data: mapPins, isLoading: mapLoading } = useQuery<MapPin[]>({
    queryKey: ['restaurants-map'],
    queryFn: async () => {
      const res = await fetch('/api/v1/restaurants/map')
      if (!res.ok) throw new Error('Failed to load map data')
      return res.json()
    },
    staleTime: 60_000,
  })

  // List — all reviewed restaurants with optional search filter (includes null lat/lng — D-11)
  const { data: listRestaurants, isLoading: listLoading } = useQuery<ReviewedRestaurant[]>({
    queryKey: ['restaurants-reviewed', debouncedQuery],
    queryFn: async () => {
      const url = debouncedQuery.trim()
        ? `/api/v1/restaurants/reviewed?q=${encodeURIComponent(debouncedQuery)}`
        : '/api/v1/restaurants/reviewed'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load restaurants')
      return res.json()
    },
    staleTime: 30_000,
  })

  // LO-03: Guard for missing API key — avoids passing undefined to APIProvider which breaks silently
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-text-secondary">
          Map unavailable — Google Maps API key not configured.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)]">
      {/* Map area */}
      <div className="flex-1 relative">
        {(mapLoading || !mapCenter) && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg">
            <Loader2 size={32} className="animate-spin text-text-secondary" />
          </div>
        )}
        {mapCenter && (
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
          <Map
            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID'}
            defaultZoom={12}
            defaultCenter={mapCenter}
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: '100%', height: '100%' }}
          >
            {(mapPins ?? []).map(pin => (
              <AdvancedMarker
                key={pin.id}
                position={{ lat: parseFloat(pin.lat), lng: parseFloat(pin.lng) }}
                onClick={() => setSelectedPin(pin)}
              >
                <Pin
                  background={pin.reviewedByFollowed ? '#E85D4A' : '#9CA3AF'}
                  glyphColor="#FFFFFF"
                  borderColor={pin.reviewedByFollowed ? '#C24332' : '#6B7280'}
                />
              </AdvancedMarker>
            ))}
            {selectedPin && (
              <InfoWindow
                position={{ lat: parseFloat(selectedPin.lat), lng: parseFloat(selectedPin.lng) }}
                onCloseClick={() => setSelectedPin(null)}
              >
                <p className="text-[14px] font-semibold text-text-primary">{selectedPin.name}</p>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
        )}
      </div>

      {/* List panel */}
      <aside className="w-full md:w-[320px] overflow-y-auto border-t md:border-t-0 md:border-l border-border bg-bg flex flex-col">
        <div className="p-4 border-b border-border">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by neighborhood or city"
            className="w-full px-3 py-2 rounded-[8px] border border-border bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Search restaurants by neighborhood or city"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {listLoading && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-text-secondary" />
            </div>
          )}
          {!listLoading && (listRestaurants ?? []).length === 0 && (
            <div className="px-4 py-8 text-center">
              <MapPinIcon size={32} className="text-text-secondary mx-auto mb-3" />
              <p className="text-[16px] font-semibold text-text-primary mb-1">No restaurants found</p>
              <p className="text-[14px] text-text-secondary">
                Try a different neighborhood or city name.
              </p>
            </div>
          )}
          {(listRestaurants ?? []).map(restaurant => (
            <div
              key={restaurant.id}
              className="px-4 py-3 border-b border-border flex items-center gap-2"
            >
              {restaurant.reviewedByFollowed && (
                <span className="text-[11px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
                  Following
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-text-primary truncate">{restaurant.name}</p>
                {(restaurant.city ?? restaurant.address) && (
                  <p className="text-[13px] text-text-secondary truncate">
                    {restaurant.city ?? restaurant.address}
                  </p>
                )}
                {!restaurant.lat && (
                  <p className="text-[11px] text-text-secondary">No map location</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
