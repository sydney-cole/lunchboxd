import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifications } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { eq, and } from 'drizzle-orm'

export async function PATCH() {
  // T-06-02-03: userId always from resolveUserId(clerkId) — never from request body
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

  return NextResponse.json({ ok: true })
}
