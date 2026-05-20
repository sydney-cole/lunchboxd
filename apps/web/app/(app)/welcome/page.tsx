'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

export default function WelcomePage() {
  const { data } = useQuery<{ user: { username: string } }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/v1/users/me').then(r => r.json()),
  })
  const username = data?.user.username ?? 'there'

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
        </div>
      </div>
    </div>
  )
}
