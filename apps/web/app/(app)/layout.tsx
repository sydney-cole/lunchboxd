import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { resolveUserId } from '@/lib/queries'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId: clerkId } = await auth()

  if (!clerkId) {
    redirect('/sign-in?expired=true')
  }

  const userId = await resolveUserId(clerkId)
  if (!userId) {
    redirect('/setup-username')
  }

  return <>{children}</>
}
