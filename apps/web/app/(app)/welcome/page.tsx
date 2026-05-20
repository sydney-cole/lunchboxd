'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function WelcomePage() {
  const { data } = useQuery<{ user: { username: string } }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/v1/users/me').then(r => r.json()),
  })
  const username = data?.user.username ?? 'there'

  const clerk = useClerk()
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleLogout() {
    await clerk.signOut()
    router.push('/sign-in')
  }

  async function handleDeleteAccount() {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/v1/users/me', { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      await clerk.signOut()
      router.push('/sign-in')
    } catch {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-[480px] w-full text-center">
        {/* Heading */}
        <h1 className="font-[family-name:--font-fraunces] text-[32px] font-semibold text-text-primary leading-[1.15] mb-4">
          Welcome to Lunchboxd, @{username}
        </h1>

        {/* Body */}
        <p className="text-[16px] font-[family-name:--font-inter] text-text-primary leading-relaxed mb-10">
          Lunchboxd is your personal food diary. Log every meal, follow friends, and see what your people are eating.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-2 w-full max-w-[320px] mx-auto">
          {/* Primary CTA */}
          <Link
            href="/"
            className="w-full h-[44px] bg-accent hover:bg-accent-hover active:bg-accent-active text-white text-[16px] font-semibold font-[family-name:--font-inter] rounded-lg transition-colors flex items-center justify-center"
          >
            Log your first meal
          </Link>

          {/* Secondary CTA */}
          <Link
            href="/"
            className="w-full h-[44px] border border-border hover:border-accent bg-transparent text-text-primary text-[16px] font-semibold font-[family-name:--font-inter] rounded-lg transition-colors flex items-center justify-center"
          >
            Find friends to follow
          </Link>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full h-[44px] border border-border hover:border-accent bg-transparent text-text-primary text-[16px] font-semibold font-[family-name:--font-inter] rounded-lg transition-colors flex items-center justify-center"
          >
            Log out
          </button>

          {/* Delete account */}
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="mt-2 text-[14px] font-[family-name:--font-inter] text-text-secondary hover:text-destructive transition-colors"
          >
            Delete account
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50">
          <div className="bg-surface rounded-xl p-6 max-w-[360px] w-full shadow-lg">
            <h2 className="font-[family-name:--font-fraunces] text-[20px] font-semibold text-text-primary mb-2">
              Delete your account?
            </h2>
            <p className="text-[14px] font-[family-name:--font-inter] text-text-secondary mb-6">
              This will permanently delete your profile, reviews, and all associated data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="flex-1 h-[44px] border border-border bg-transparent text-text-primary text-[16px] font-semibold font-[family-name:--font-inter] rounded-lg transition-colors hover:border-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 h-[44px] bg-destructive hover:opacity-90 text-white text-[16px] font-semibold font-[family-name:--font-inter] rounded-lg transition-opacity flex items-center justify-center disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={20} className="animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
