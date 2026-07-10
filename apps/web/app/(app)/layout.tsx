import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NotificationBell } from '@/components/notification-bell'
import { MobileNav } from '@/components/mobile-nav'
import { UserMenu } from '@/components/user-menu'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId: clerkId } = await auth()

  if (!clerkId) {
    redirect('/sign-in?expired=true')
  }

  const [user] = await db
    .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl, displayName: users.displayName })
    .from(users)
    .where(eq(users.clerkId, clerkId))

  if (!user) {
    redirect('/setup-username')
  }

  const initial = (user.displayName ?? user.username).charAt(0).toUpperCase()

  return (
    <>
      <nav className="h-16 border-b border-border bg-white/90 backdrop-blur-lg flex items-center px-4 md:px-6 sticky top-0 z-40">
        {/* Left: Logo */}
        <Link
          href="/"
          className="font-[family-name:--font-fraunces] text-[22px] font-bold text-text-primary shrink-0 w-auto md:w-44 hover:text-accent transition-colors duration-150"
        >
          lunchboxd
        </Link>

        {/* Center: Nav links — desktop only */}
        <div className="hidden md:flex flex-1 items-center justify-center gap-0.5">
          <Link
            href="/"
            className="text-[14px] font-medium text-text-secondary hover:text-text-primary px-4 py-2 rounded-full hover:bg-accent-subtle transition-all duration-150"
          >
            Feed
          </Link>
          <Link
            href="/search"
            className="text-[14px] font-medium text-text-secondary hover:text-text-primary px-4 py-2 rounded-full hover:bg-accent-subtle transition-all duration-150"
          >
            Search
          </Link>
          <Link
            href="/reviews"
            className="text-[14px] font-medium text-text-secondary hover:text-text-primary px-4 py-2 rounded-full hover:bg-accent-subtle transition-all duration-150"
          >
            My Reviews
          </Link>
          <Link
            href="/map"
            className="text-[14px] font-medium text-text-secondary hover:text-text-primary px-4 py-2 rounded-full hover:bg-accent-subtle transition-all duration-150"
          >
            Map
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 ml-auto w-auto md:w-44 justify-end">
          <NotificationBell />
          <UserMenu username={user.username} avatarUrl={user.avatarUrl} initial={initial} />
        </div>
      </nav>

      {/* Bottom padding on mobile clears the fixed bottom tab bar (h-14 + safe area) */}
      <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>

      <MobileNav username={user.username} avatarUrl={user.avatarUrl} />
    </>
  )
}
