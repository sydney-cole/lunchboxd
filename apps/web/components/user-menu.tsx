'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { LogOut, User } from 'lucide-react'

interface UserMenuProps {
  username: string
  avatarUrl: string | null
  initial: string
}

export function UserMenu({ username, avatarUrl, initial }: UserMenuProps) {
  const router = useRouter()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function handleSignOut() {
    setOpen(false)
    signOut(() => router.push('/sign-in'))
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-9 h-9 rounded-full bg-accent/15 hover:bg-accent/25 transition-all duration-150 flex items-center justify-center overflow-hidden ring-2 ring-transparent hover:ring-accent/40 ring-offset-1 focus:outline-none focus:ring-accent/60"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[13px] font-bold text-accent">{initial}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-white shadow-[0_8px_28px_rgba(0,0,0,0.12)] py-1.5 z-50 overflow-hidden"
        >
          <a
            href={`/@${username}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-accent-subtle hover:text-text-primary transition-colors duration-150"
          >
            <User size={17} strokeWidth={2} />
            Your profile
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-accent-subtle hover:text-text-primary transition-colors duration-150 text-left"
          >
            <LogOut size={17} strokeWidth={2} />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
