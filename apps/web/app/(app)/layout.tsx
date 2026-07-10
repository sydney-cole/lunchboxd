import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NotificationBell } from '@/components/notification-bell'
import { MobileNav } from '@/components/mobile-nav'

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
        <a
          href="/"
          className="font-[family-name:--font-fraunces] text-[22px] font-bold text-text-primary shrink-0 w-auto md:w-44 hover:text-accent transition-colors duration-150"
        >
          lunchboxd
        </a>

        {/* Center: Nav links — desktop only */}
        <div className="hidden md:flex flex-1 items-center justify-center gap-0.5">
          <a
            href="/"
            className="text-[14px] font-medium text-text-secondary hover:text-text-primary px-4 py-2 rounded-full hover:bg-accent-subtle transition-all duration-150"
          >
            Feed
          </a>
          <a
            href="/search"
            className="text-[14px] font-medium text-text-secondary hover:text-text-primary px-4 py-2 rounded-full hover:bg-accent-subtle transition-all duration-150"
          >
            Search
          </a>
          <a
            href="/reviews"
            className="text-[14px] font-medium text-text-secondary hover:text-text-primary px-4 py-2 rounded-full hover:bg-accent-subtle transition-all duration-150"
          >
            My Reviews
          </a>
          <a
            href="/map"
            className="text-[14px] font-medium text-text-secondary hover:text-text-primary px-4 py-2 rounded-full hover:bg-accent-subtle transition-all duration-150"
          >
            Map
          </a>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 ml-auto w-auto md:w-44 justify-end">
          <NotificationBell />
          <a
            href={`/@${user.username}`}
            aria-label="Your profile"
            className="w-9 h-9 rounded-full bg-accent/15 hover:bg-accent/25 transition-all duration-150 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-transparent hover:ring-accent/40 ring-offset-1"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[13px] font-bold text-accent">{initial}</span>
            )}
          </a>
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
