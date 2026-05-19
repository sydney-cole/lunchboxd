import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted ensures these variables are available when vi.mock factories run
const {
  mockLimit,
  mockReturning,
  mockOnConflictDoUpdate,
  mockValues,
  mockInsert,
  mockSelect,
} = vi.hoisted(() => {
  const mockReturning = vi.fn()
  const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }))
  const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))
  const mockLimit = vi.fn()
  const mockWhere = vi.fn(() => ({ limit: mockLimit }))
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  return { mockLimit, mockReturning, mockOnConflictDoUpdate, mockValues, mockInsert, mockSelect }
})

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user_test123' }),
}))

vi.mock('@/lib/db', () => ({
  db: { select: mockSelect, insert: mockInsert },
}))

vi.mock('@/lib/schema', () => ({
  restaurants: {},
}))

vi.mock('drizzle-orm', () => ({
  ilike: vi.fn().mockReturnValue('mocked-condition'),
}))

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'

const makePlacesResponse = (places: object[]) =>
  new Response(JSON.stringify({ places }), { status: 200, headers: { 'Content-Type': 'application/json' } })

const makePlacesPlace = (overrides = {}) => ({
  id: 'ChIJtest123',
  displayName: { text: 'Tacolicious' },
  formattedAddress: '741 Valencia St, San Francisco, CA',
  location: { latitude: 37.762, longitude: -122.421 },
  ...overrides,
})

const makeRequest = (q: string) =>
  new NextRequest(`http://localhost/api/v1/restaurants/search?q=${encodeURIComponent(q)}`)

describe('GET /api/v1/restaurants/search — Google Places integration', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
    process.env.GOOGLE_PLACES_API_KEY = 'test-api-key'
    // Default: empty DB cache → triggers Places API call
    mockLimit.mockResolvedValue([])
    // Default upsert return: single row
    mockReturning.mockResolvedValue([{
      id: 'db-id-1',
      placeId: 'ChIJtest123',
      name: 'Tacolicious',
      address: '741 Valencia St, San Francisco, CA',
      lat: '37.762',
      lng: '-122.421',
      source: 'google_places',
    }])
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.GOOGLE_PLACES_API_KEY
  })

  it('calls the Places searchText endpoint with correct URL, method, and API key header', async () => {
    fetchSpy.mockResolvedValueOnce(makePlacesResponse([makePlacesPlace()]))
    const { GET } = await import('../app/api/v1/restaurants/search/route')

    await GET(makeRequest('tacos'))

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect(url).toBe(PLACES_URL)
    expect(options.method).toBe('POST')
    expect(options.headers['X-Goog-Api-Key']).toBe('test-api-key')
  })

  it('sends the search query as textQuery with includedType: restaurant in the request body', async () => {
    fetchSpy.mockResolvedValueOnce(makePlacesResponse([makePlacesPlace()]))
    const { GET } = await import('../app/api/v1/restaurants/search/route')

    await GET(makeRequest('tacos'))

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body).toMatchObject({ textQuery: 'tacos', includedType: 'restaurant' })
  })

  it('requests the correct field mask so Places only returns the fields the route needs', async () => {
    fetchSpy.mockResolvedValueOnce(makePlacesResponse([makePlacesPlace()]))
    const { GET } = await import('../app/api/v1/restaurants/search/route')

    await GET(makeRequest('tacos'))

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect(options.headers['X-Goog-FieldMask']).toBe(
      'places.id,places.displayName,places.formattedAddress,places.location'
    )
  })

  it('returns the upserted restaurant row from the Places response', async () => {
    fetchSpy.mockResolvedValueOnce(makePlacesResponse([makePlacesPlace()]))
    const { GET } = await import('../app/api/v1/restaurants/search/route')

    const res = await GET(makeRequest('tacos'))
    const body = await res.json()

    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ name: 'Tacolicious', source: 'google_places' })
  })

  it('skips the Places API and returns cache when the DB already has 5+ results', async () => {
    const cached = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`, name: `Restaurant ${i}`, address: null, lat: null, lng: null,
    }))
    mockLimit.mockResolvedValue(cached)
    const { GET } = await import('../app/api/v1/restaurants/search/route')

    const res = await GET(makeRequest('tacos'))

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(await res.json()).toHaveLength(5)
  })

  it('returns an empty array without calling Places API for a query shorter than 2 characters', async () => {
    const { GET } = await import('../app/api/v1/restaurants/search/route')

    const res = await GET(makeRequest('t'))

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(await res.json()).toEqual([])
  })

  it('falls back to cached DB results when the Places API returns a non-ok response', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('', { status: 500 }))
    const cached = [{ id: '1', name: 'Local Taqueria', address: null, lat: null, lng: null }]
    mockLimit.mockResolvedValue(cached)
    const { GET } = await import('../app/api/v1/restaurants/search/route')

    const res = await GET(makeRequest('tacos'))

    expect(await res.json()).toEqual(cached)
  })

  it('falls back to cached DB results when the Places API call throws', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network error'))
    const cached = [{ id: '1', name: 'Local Taqueria', address: null, lat: null, lng: null }]
    mockLimit.mockResolvedValue(cached)
    const { GET } = await import('../app/api/v1/restaurants/search/route')

    const res = await GET(makeRequest('tacos'))

    expect(await res.json()).toEqual(cached)
  })

  it('returns 401 and does not call Places API when the user is not authenticated', async () => {
    const { auth } = await import('@clerk/nextjs/server')
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as any)
    const { GET } = await import('../app/api/v1/restaurants/search/route')

    const res = await GET(makeRequest('tacos'))

    expect(res.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('gracefully returns cached results when no Places API key is configured', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY
    const cached = [{ id: '1', name: 'Local Taqueria', address: null, lat: null, lng: null }]
    mockLimit.mockResolvedValue(cached)
    const { GET } = await import('../app/api/v1/restaurants/search/route')

    const res = await GET(makeRequest('tacos'))

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(await res.json()).toEqual(cached)
  })
})
