export const runtime = 'nodejs'

import { Webhook } from 'svix'
import { headers } from 'next/headers'
import type { WebhookEvent } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    throw new Error('Missing CLERK_WEBHOOK_SECRET environment variable')
  }

  // Next.js 16: headers() is async
  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const svixHeaders = {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let event: WebhookEvent

  try {
    event = wh.verify(body, svixHeaders) as WebhookEvent
  } catch {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  if (event.type === 'user.created') {
    const email = event.data.email_addresses[0]?.email_address ?? ''
    // Upsert — POST /api/v1/users may have already created the row with username
    await db.insert(users).values({
      clerkId: event.data.id,
      email,
      username: '', // will be set by POST /api/v1/users (Pitfall 4 from RESEARCH.md)
    }).onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email,
        updatedAt: new Date(),
      },
    })
  } else if (event.type === 'user.updated') {
    const email = event.data.email_addresses[0]?.email_address ?? ''
    const displayName = [event.data.first_name, event.data.last_name]
      .filter(Boolean)
      .join(' ') || null
    await db
      .update(users)
      .set({
        email,
        displayName,
        avatarUrl: event.data.image_url ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, event.data.id))
  } else if (event.type === 'user.deleted') {
    if (event.data.id) {
      await db.delete(users).where(eq(users.clerkId, event.data.id))
    }
  }

  return new Response('OK', { status: 200 })
}
