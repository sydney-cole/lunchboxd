import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { restaurants } from '@/lib/schema'

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, address, city } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 })
  }

  // Best-effort geocoding when address/city provided and Places key is configured
  let lat: string | null = null
  let lng: string | null = null
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (apiKey && (address || city)) {
    const locationQuery = [address, city].filter(Boolean).join(', ')
    try {
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationQuery)}&key=${apiKey}`
      )
      const geoData = await geoRes.json()
      const loc = geoData.results?.[0]?.geometry?.location
      if (loc) {
        lat = loc.lat.toString()
        lng = loc.lng.toString()
      }
    } catch { /* geocoding is best-effort — proceed without coordinates */ }
  }

  const [row] = await db.insert(restaurants).values({
    placeId: null,
    source: 'manual',
    name: name.trim(),
    address: typeof address === 'string' && address.trim() ? address.trim() : null,
    city: typeof city === 'string' && city.trim() ? city.trim() : null,
    lat,
    lng,
  }).returning()

  return NextResponse.json(row, { status: 201 })
}
