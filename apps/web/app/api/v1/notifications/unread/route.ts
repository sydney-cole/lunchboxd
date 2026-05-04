import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifications } from '@/lib/schema'
import { resolveUserId } from '@/lib/queries'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await resolveUserId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // limit(1) trick — only need to know if any unread exists, no count needed
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
    .limit(1)

  return NextResponse.json({ hasUnread: rows.length > 0 })
}
