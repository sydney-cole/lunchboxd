'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import { Loader2, MapPin as MapPinIcon } from 'lucide-react'
import Link from 'next/link'

type MapFilter = 'anywhere' | 'friends' | 'mine'

interface MapPin {
  id: string
  name: string
  lat: string
  lng: string
  reviewedByFollowed: boolean
  reviewedByMe: boolean
}

interface FocusPin {
  id: string
  name: string
  lat: number
  lng: number
  reviewCount: number
}

interface ListRestaurant {
  id: string
  name: string
  city?: string | null
  address: string | null
  lat: string | null
  lng: string | null
  reviewCount?: number
}

const NYC_FALLBACK = { lat: 40.7128, lng: -74.006 }

function MapController({ focusLocation }: { focusLocation: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (map && focusLocation) {
      map.panTo(focusLocation)
      map.setZoom(15)
    }
  }, [map, focusLocation])
  return null
}

const FILTER_LABELS: Record<MapFilter, string> = {
  anywhere: 'Anywhere',
  friends: 'Friends',
  mine: 'Mine',
}

export default function MapPage() {
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null)
  const [focusPin, setFocusPin] = useState<FocusPin | null>(null)
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<MapFilter>('anywhere')
  const [focusLocation, setFocusLocation] = useState<{ lat: number; lng: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    document.title = 'Map · Lunchboxd'
  }, [])

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

  const { data: mapPins, isLoading: mapLoading } = useQuery<MapPin[]>({
    queryKey: ['restaurants-map'],
    queryFn: async () => {
      const res = await fetch('/api/v1/restaurants/map')
      if (!res.ok) throw new Error('Failed to load map data')
      return res.json()
    },
    staleTime: 60_000,
  })

  const isAnywhere = activeFilter === 'anywhere'
  const hasQuery = debouncedQuery.trim().length > 0

  const { data: listRestaurants, isLoading: listLoading } = useQuery<ListRestaurant[]>({
    queryKey: ['restaurants-list', debouncedQuery, activeFilter, mapCenter],
    queryFn: async () => {
      if (isAnywhere) {
        if (!hasQuery) return []
        const params = new URLSearchParams({ q: debouncedQuery.trim() })
        if (mapCenter) {
          params.set('lat', mapCenter.lat.toString())
          params.set('lng', mapCenter.lng.toString())
        }
        const res = await fetch(`/api/v1/restaurants/search?${params}`)
        if (!res.ok) throw new Error('Failed to load restaurants')
        return res.json()
      }
      const params = new URLSearchParams({ filter: activeFilter })
      if (hasQuery) params.set('q', debouncedQuery.trim())
      const res = await fetch(`/api/v1/restaurants/reviewed?${params}`)
      if (!res.ok) throw new Error('Failed to load restaurants')
      return res.json()
    },
    staleTime: 30_000,
  })

  const visiblePins = (mapPins ?? []).filter(pin => {
    if (activeFilter === 'mine') return pin.reviewedByMe
    if (activeFilter === 'friends') return pin.reviewedByFollowed
    return true
  })

  const handleRestaurantClick = (restaurant: ListRestaurant) => {
    if (!restaurant.lat || !restaurant.lng) return
    const loc = { lat: parseFloat(restaurant.lat), lng: parseFloat(restaurant.lng) }
    setFocusLocation(loc)
    setActiveRestaurantId(restaurant.id)
    const pin = (mapPins ?? []).find(p => p.id === restaurant.id)
    if (pin) {
      setSelectedPin(pin)
      setFocusPin(null)
    } else {
      setFocusPin({ id: restaurant.id, name: restaurant.name, lat: loc.lat, lng: loc.lng, reviewCount: restaurant.reviewCount ?? 0 })
      setSelectedPin(null)
    }
  }

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
            <MapController focusLocation={focusLocation} />

            {visiblePins.map(pin => (
              <AdvancedMarker
                key={pin.id}
                position={{ lat: parseFloat(pin.lat), lng: parseFloat(pin.lng) }}
                onClick={() => { setSelectedPin(pin); setFocusPin(null); setActiveRestaurantId(pin.id) }}
              >
                <Pin
                  background={pin.reviewedByMe ? '#E85D4A' : pin.reviewedByFollowed ? '#F5A623' : '#9CA3AF'}
                  glyphColor="#FFFFFF"
                  borderColor={pin.reviewedByMe ? '#C24332' : pin.reviewedByFollowed ? '#C47D0D' : '#6B7280'}
                />
              </AdvancedMarker>
            ))}

            {/* Temporary pin for restaurants not yet in mapPins (e.g. Anywhere search results) */}
            {focusPin && (
              <AdvancedMarker
                position={{ lat: focusPin.lat, lng: focusPin.lng }}
                onClick={() => {}}
              >
                <Pin background="#3B82F6" glyphColor="#FFFFFF" borderColor="#1D4ED8" />
              </AdvancedMarker>
            )}

            {selectedPin && (
              <InfoWindow
                position={{ lat: parseFloat(selectedPin.lat), lng: parseFloat(selectedPin.lng) }}
                onCloseClick={() => { setSelectedPin(null); setActiveRestaurantId(null) }}
                disableAutoPan
              >
                <div className="p-1 min-w-[180px]">
                  <p className="text-[14px] font-semibold text-text-primary mb-2">{selectedPin.name}</p>
                  <div className="flex flex-col gap-1.5">
                    <Link
                      href={`/restaurants/${selectedPin.id}`}
                      className="inline-block text-[12px] font-semibold text-white bg-accent hover:bg-accent/90 px-3 py-1.5 rounded-[6px] transition-colors text-center"
                    >
                      View Profile
                    </Link>
                    <Link
                      href={`/reviews/new?restaurantId=${encodeURIComponent(selectedPin.id)}&restaurantName=${encodeURIComponent(selectedPin.name)}`}
                      className="inline-block text-[12px] font-medium text-accent hover:underline px-1 text-center"
                    >
                      + Write a Review
                    </Link>
                  </div>
                </div>
              </InfoWindow>
            )}

            {focusPin && (
              <InfoWindow
                position={{ lat: focusPin.lat, lng: focusPin.lng }}
                onCloseClick={() => { setFocusPin(null); setActiveRestaurantId(null) }}
                disableAutoPan
              >
                <div className="p-1 min-w-[180px]">
                  <p className="text-[14px] font-semibold text-text-primary mb-2">{focusPin.name}</p>
                  <div className="flex flex-col gap-1.5">
                    {focusPin.reviewCount > 0 ? (
                      <>
                        <Link
                          href={`/restaurants/${focusPin.id}`}
                          className="inline-block text-[12px] font-semibold text-white bg-accent hover:bg-accent/90 px-3 py-1.5 rounded-[6px] transition-colors text-center"
                        >
                          View Profile
                        </Link>
                        <Link
                          href={`/reviews/new?restaurantId=${encodeURIComponent(focusPin.id)}&restaurantName=${encodeURIComponent(focusPin.name)}`}
                          className="inline-block text-[12px] font-medium text-accent hover:underline px-1 text-center"
                        >
                          + Write a Review
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={`/reviews/new?restaurantId=${encodeURIComponent(focusPin.id)}&restaurantName=${encodeURIComponent(focusPin.name)}`}
                        className="inline-block text-[12px] font-semibold text-white bg-accent hover:bg-accent/90 px-3 py-1.5 rounded-[6px] transition-colors text-center"
                      >
                        + Write a Review
                      </Link>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
        )}
      </div>

      {/* List panel */}
      <aside className="w-full md:w-[320px] overflow-y-auto border-t md:border-t-0 md:border-l border-border bg-bg flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={isAnywhere ? 'Search any restaurant…' : 'Search restaurants'}
            className="w-full px-3 py-2 rounded-[8px] border border-border bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Search restaurants by name"
          />
          <div className="flex gap-1">
            {(Object.keys(FILTER_LABELS) as MapFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`flex-1 text-[13px] font-medium py-1.5 rounded-[6px] transition-colors ${
                  activeFilter === f
                    ? 'bg-accent text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
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
              <p className="text-[16px] font-semibold text-text-primary mb-1">
                {isAnywhere && !hasQuery ? 'Find any restaurant' : 'No restaurants found'}
              </p>
              <p className="text-[14px] text-text-secondary">
                {isAnywhere && !hasQuery
                  ? 'Search by name to find any restaurant.'
                  : hasQuery
                    ? 'Try a different search term.'
                    : activeFilter === 'mine'
                      ? "You haven't reviewed any restaurants yet."
                      : "None of your friends have reviewed restaurants yet."}
              </p>
            </div>
          )}
          {(listRestaurants ?? []).map(restaurant => {
            const isActive = activeRestaurantId === restaurant.id
            const hasLocation = Boolean(restaurant.lat && restaurant.lng)
            const isReviewed = (restaurant.reviewCount ?? 0) > 0
            return (
              <div
                key={restaurant.id}
                onClick={() => handleRestaurantClick(restaurant)}
                className={`group px-4 py-3 border-b border-border transition-colors ${
                  hasLocation ? 'cursor-pointer' : ''
                } ${isActive ? 'bg-accent/8' : hasLocation ? 'hover:bg-bg-secondary active:bg-bg-secondary/80' : ''}`}
              >
                <p className={`text-[14px] font-semibold truncate transition-colors ${
                  isActive
                    ? 'text-accent'
                    : hasLocation
                      ? 'text-text-primary group-hover:text-accent'
                      : 'text-text-primary'
                }`}>
                  {restaurant.name}
                </p>
                {(restaurant.city ?? restaurant.address) && (
                  <p className="text-[13px] text-text-secondary truncate">
                    {restaurant.city ?? restaurant.address}
                  </p>
                )}
                {!hasLocation && (
                  <p className="text-[11px] text-text-tertiary">No map location</p>
                )}
                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                  {isReviewed ? (
                    <a
                      href={`/restaurants/${restaurant.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition-colors"
                    >
                      ✓ {restaurant.reviewCount} {restaurant.reviewCount === 1 ? 'review' : 'reviews'}
                    </a>
                  ) : (
                    <a
                      href={`/reviews/new?restaurantId=${encodeURIComponent(restaurant.id)}&restaurantName=${encodeURIComponent(restaurant.name)}`}
                      className="text-[11px] font-medium text-accent hover:underline"
                    >
                      + Add a review
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
