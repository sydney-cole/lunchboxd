'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Map, Plus, User } from 'lucide-react'

interface MobileNavProps {
  username: string
  avatarUrl: string | null
}

type Tab = {
  href: string
  label: string
  icon: React.ReactNode
  /** Match when the pathname starts with `href` (for nested routes). */
  match: (pathname: string) => boolean
}

export function MobileNav({ username, avatarUrl }: MobileNavProps) {
  const pathname = usePathname()
  const profileHref = `/@${username}`

  const tabs: Tab[] = [
    {
      href: '/',
      label: 'Feed',
      icon: <Home size={22} strokeWidth={2} />,
      match: (p) => p === '/',
    },
    {
      href: '/search',
      label: 'Search',
      icon: <Search size={22} strokeWidth={2} />,
      match: (p) => p.startsWith('/search'),
    },
    {
      href: '/reviews/new',
      label: 'New',
      icon: <Plus size={26} strokeWidth={2.5} />,
      match: (p) => p.startsWith('/reviews/new'),
    },
    {
      href: '/map',
      label: 'Map',
      icon: <Map size={22} strokeWidth={2} />,
      match: (p) => p.startsWith('/map'),
    },
    {
      href: profileHref,
      label: 'Profile',
      icon: avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
      ) : (
        <User size={22} strokeWidth={2} />
      ),
      match: (p) => p === profileHref || p === encodeURI(profileHref),
    },
  ]

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-lg border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around h-14">
        {tabs.map((tab) => {
          const isActive = tab.match(pathname)
          const isNew = tab.label === 'New'

          if (isNew) {
            return (
              <li key={tab.href} className="flex items-center justify-center">
                <Link
                  href={tab.href}
                  aria-label="Write a review"
                  className="flex items-center justify-center w-11 h-11 rounded-full bg-accent text-white shadow-[0_2px_10px_rgba(249,115,22,0.40)] active:scale-95 active:bg-accent-active transition-transform duration-150"
                >
                  {tab.icon}
                </Link>
              </li>
            )
          }

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 h-full transition-colors duration-150 ${
                  isActive ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
