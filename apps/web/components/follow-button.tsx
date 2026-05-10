'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

type FollowState = 'none' | 'following' | 'friends'

interface FollowButtonProps {
  targetUserId: string
  initialState: FollowState
}

export function FollowButton({ targetUserId, initialState }: FollowButtonProps) {
  const queryClient = useQueryClient()
  // HI-01: Track local follow state via useState — initialState is prop for first-render only
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
      // Update local state from the API response (authoritative follow state)
      setCurrentState(data.followState)
      // Invalidate search results to refresh follow states in other UI
      queryClient.invalidateQueries({ queryKey: ['user-search'] })
    },
  })

  const isLoading = followMutation.isPending

  // Per D-07: three label states, label change only — no badge or icon
  const handleClick = () => {
    if (currentState === 'none') {
      followMutation.mutate({ action: 'follow' })
    } else {
      // 'following' or 'friends' → unfollow
      followMutation.mutate({ action: 'unfollow' })
    }
  }

  const label =
    currentState === 'friends'
      ? 'Friends'
      : currentState === 'following'
        ? 'Following'
        : 'Follow'

  // Style: "Follow" = filled accent, "Following"/"Friends" = outline
  const baseClasses =
    'px-4 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50'
  const stateClasses =
    currentState === 'none'
      ? 'bg-accent text-white hover:bg-accent/90'
      : 'border border-border text-text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={`${baseClasses} ${stateClasses}`}
    >
      {isLoading ? '...' : label}
    </button>
  )
}
