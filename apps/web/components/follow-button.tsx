'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

type FollowState = 'none' | 'following' | 'friends'

interface FollowButtonProps {
  targetUserId: string
  initialState: FollowState
}

export function FollowButton({ targetUserId, initialState }: FollowButtonProps) {
  const queryClient = useQueryClient()
  const [currentState, setCurrentState] = useState<FollowState>(initialState)

  const followMutation = useMutation({
    mutationFn: async ({ action }: { action: 'follow' | 'unfollow' }) => {
      const res = await fetch('/api/v1/follows', {
        method: action === 'follow' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      })
      if (!res.ok) throw new Error('Follow action failed')
      return res.json() as Promise<{ followState: FollowState }>
    },
    onSuccess: (data) => {
      setCurrentState(data.followState)
      queryClient.invalidateQueries({ queryKey: ['user-search'] })
    },
  })

  const isLoading = followMutation.isPending

  const handleClick = () => {
    if (currentState === 'none') {
      followMutation.mutate({ action: 'follow' })
    } else {
      followMutation.mutate({ action: 'unfollow' })
    }
  }

  const label =
    currentState === 'friends'
      ? 'Friends'
      : currentState === 'following'
        ? 'Following'
        : 'Follow'

  const isFollowing = currentState !== 'none'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={`inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-full text-[14px] font-semibold transition-all duration-150 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 ${
        isFollowing
          ? 'border border-border-strong text-text-primary hover:border-destructive hover:text-destructive hover:bg-red-50'
          : 'bg-accent text-white hover:bg-accent-hover shadow-[0_1px_3px_rgba(249,115,22,0.20)]'
      }`}
    >
      {isLoading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : null}
      {label}
    </button>
  )
}
