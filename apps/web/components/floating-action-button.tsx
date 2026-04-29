'use client'

import React from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'

interface FloatingActionButtonProps {
  href?: string
}

export function FloatingActionButton({ href = '/reviews/new' }: FloatingActionButtonProps) {
  return (
    <Link
      href={href}
      aria-label="Write a review"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-[56px] h-[56px] rounded-full bg-accent hover:bg-accent-hover active:bg-accent-active active:scale-95 text-white shadow-[0_4px_12px_rgba(249,115,22,0.35)] transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      style={{ backgroundColor: '#F97316' }}
    >
      <Plus size={24} color="white" />
    </Link>
  )
}
