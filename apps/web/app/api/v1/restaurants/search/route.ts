import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { restaurants } from '@/lib/schema'
import { ilike } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json([])

  // 1. Check local cache first
  const cached = await db.select().from(restaurants)
    .where(ilike(restaurants.name, `%${q}%`))
    .limit(5)

  if (cached.length > 0) return NextResponse.json(cached)

  // 2. Call Google Places (New) searchText endpoint
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    // Graceful fallback — no Places API key configured
    return NextResponse.json([])
  }

  try {
    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({ textQuery: q, includedType: 'restaurant' }),
    })

    if (!placesRes.ok) return NextResponse.json([])

    const { places = [] } = await placesRes.json()

    // 3. Upsert into local restaurants table (cache)
    const results = await Promise.all(
      places.slice(0, 5).map(async (p: any) => {
        const [row] = await db.insert(restaurants).values({
          placeId: p.id,
          source: 'google_places',
          name: p.displayName?.text ?? '',
          address: p.formattedAddress ?? null,
          lat: p.location?.latitude?.toString() ?? null,
          lng: p.location?.longitude?.toString() ?? null,
        })
        .onConflictDoUpdate({
          target: restaurants.placeId,
          set: {
            name: p.displayName?.text ?? '',
            address: p.formattedAddress ?? null,
          },
        })
        .returning()
        return row
      })
    )

    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}
