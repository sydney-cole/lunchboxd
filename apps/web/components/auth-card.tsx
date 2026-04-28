'use client'

import React from 'react'

interface AuthCardProps {
  heading: string
  children: React.ReactNode
}

export default function AuthCard({ heading, children }: AuthCardProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-4 py-8">
      {/* Wordmark above card */}
      <div className="mb-6 text-center">
        <span
          className="font-[family-name:--font-fraunces] text-[32px] font-semibold text-accent leading-none"
        >
          lunchboxd
        </span>
      </div>

      {/* Auth card */}
      <div
        className="w-full max-w-[400px] bg-surface border border-border rounded-xl px-8 py-12 shadow-[0_1px_4px_0_rgba(28,25,23,0.08)] max-sm:px-6 max-sm:py-6"
      >
        <h1
          className="font-[family-name:--font-fraunces] text-[32px] font-semibold text-text-primary leading-[1.15] mb-8"
        >
          {heading}
        </h1>
        {children}
      </div>
    </div>
  )
}
