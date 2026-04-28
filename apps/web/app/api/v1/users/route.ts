import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { username } = body

  // Validate username format
  if (!username || !/^[a-zA-Z0-9_]+$/.test(username) || username.length > 30) {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 })
  }

  // Upsert — the webhook may have already created the row
  await db.insert(users).values({
    clerkId,
    username,
    email: '', // will be populated by webhook
  }).onConflictDoUpdate({
    target: users.clerkId,
    set: { username, updatedAt: new Date() },
  })

  return NextResponse.json({ success: true }, { status: 201 })
}
