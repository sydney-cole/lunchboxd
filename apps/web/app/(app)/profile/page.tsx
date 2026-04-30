import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

// /profile → redirect to /@<current-user-username>
// Per D-02: own profile redirects to /@username URL
export default async function ProfileRedirectPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.clerkId, clerkId))

  if (!user) redirect('/sign-in')

  redirect(`/@${user.username}`)
}
