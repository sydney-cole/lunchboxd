import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { restaurants } from '@/lib/schema'
import { ilike, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json([])

  // 1. Check local cache
  const cached = await db.select().from(restaurants)
    .where(ilike(restaurants.name, `%${q}%`))
    .limit(5)

  // Short-circuit only when cache has 5+ results (sufficient coverage)
  if (cached.length >= 5) return NextResponse.json(cached)

  // 2. Call Google Places (New) searchText endpoint
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    // Graceful fallback — no Places API key configured
    return NextResponse.json(cached)
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

    if (!placesRes.ok) return NextResponse.json(cached)

    const { places = [] } = await placesRes.json()

    // 3. Upsert into local restaurants table (cache)
    // NOTE: Two concurrent requests for the same query can both miss the cache
    // and call Google Places. The onConflictDoUpdate handles DB-level duplicates,
    // but the combined response may briefly return duplicate-looking rows from
    // two concurrent in-flight results. A distributed lock would be needed to
    // eliminate this; acceptable at MVP scale. (ME-06)
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
          targetWhere: sql`place_id IS NOT NULL`,
          set: {
            name: p.displayName?.text ?? '',
            address: p.formattedAddress ?? null,
          },
        })
        .returning()
        return row
      })
    )

    // CR-08: Filter out undefined entries (can occur if Neon HTTP driver returns empty array for any upsert)
    const upserted = results.filter((r): r is NonNullable<typeof r> => r !== undefined)

    // 4. Merge: cached rows not already in upserted results + fresh Places results
    const upsertedIds = new Set(upserted.map(r => r.id))
    const merged = [
      ...cached.filter(r => !upsertedIds.has(r.id)),
      ...upserted,
    ].slice(0, 5)

    return NextResponse.json(merged)
  } catch {
    return NextResponse.json(cached)
  }
}
