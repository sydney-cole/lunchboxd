import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
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
      <nav className="h-14 border-b border-border bg-surface/80 backdrop-blur-sm flex items-center px-6 sticky top-0 z-40">
        {/* Left: Logo */}
        <a href="/" className="font-[family-name:--font-fraunces] text-[20px] text-text-primary shrink-0 w-40">
          Lunchboxd
        </a>

        {/* Center: Nav links */}
        <div className="flex-1 flex items-center justify-center gap-1">
          <a href="/search" className="text-[13px] font-medium text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg hover:bg-black/5 transition-colors">
            Search
          </a>
          <a href="/reviews" className="text-[13px] font-medium text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg hover:bg-black/5 transition-colors">
            My Reviews
          </a>
          <a href="/map" className="text-[13px] font-medium text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg hover:bg-black/5 transition-colors">
            Map
          </a>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-40 justify-end">
          <NotificationBell />
          <a
            href={`/@${user.username}`}
            aria-label="Your profile"
            className="w-8 h-8 rounded-full bg-accent/20 hover:bg-accent/30 transition-colors flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-transparent hover:ring-accent/30"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[13px] font-semibold text-accent">{initial}</span>
            )}
          </a>
        </div>
      </nav>
      {children}
    </>
  )
}
