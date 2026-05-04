import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { resolveUserId } from '@/lib/queries'
import { NotificationBell } from '@/components/notification-bell'

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

  return (
    <>
      <nav className="h-16 border-b border-border bg-surface flex items-center justify-between px-4">
        <a href="/" className="font-[family-name:--font-fraunces] text-[20px] text-text-primary">
          Lunchboxd
        </a>
        <div className="flex items-center gap-2">
          <a href="/map" className="text-[14px] text-text-secondary hover:text-text-primary px-2 py-1">Map</a>
          <NotificationBell />
        </div>
      </nav>
      {children}
    </>
  )
}
