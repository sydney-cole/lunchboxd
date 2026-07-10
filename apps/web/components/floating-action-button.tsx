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
      className="hidden md:flex fixed bottom-7 right-7 z-50 items-center justify-center w-14 h-14 rounded-full bg-accent text-white shadow-[0_4px_20px_rgba(249,115,22,0.40),0_1px_4px_rgba(249,115,22,0.20)] hover:bg-accent-hover hover:shadow-[0_6px_28px_rgba(249,115,22,0.50)] active:scale-95 active:bg-accent-active transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
    >
      <Plus size={24} strokeWidth={2.5} />
    </Link>
  )
}
