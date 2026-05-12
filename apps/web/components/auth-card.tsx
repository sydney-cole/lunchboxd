'use client'

import React from 'react'

interface AuthCardProps {
  heading: string
  children: React.ReactNode
}

export default function AuthCard({ heading, children }: AuthCardProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-4 py-8">
      {/* Wordmark */}
      <div className="mb-8 text-center">
        <span className="font-[family-name:--font-fraunces] text-[36px] font-bold text-accent leading-none tracking-tight">
          lunchboxd
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[420px] bg-surface border border-border rounded-2xl px-8 py-10 shadow-[0_4px_24px_rgba(28,25,23,0.08),0_1px_4px_rgba(28,25,23,0.04)] max-sm:px-6 max-sm:py-8">
        <h1 className="font-[family-name:--font-fraunces] text-[28px] font-semibold text-text-primary leading-tight mb-7">
          {heading}
        </h1>
        {children}
      </div>
    </div>
  )
}
