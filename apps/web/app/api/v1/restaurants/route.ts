import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { restaurants } from '@/lib/schema'

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 })
  }

  const [row] = await db.insert(restaurants).values({
    placeId: null,
    source: 'manual',
    name: name.trim(),
  }).returning()

  return NextResponse.json(row, { status: 201 })
}
