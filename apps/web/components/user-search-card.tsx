'use client'

import { FollowButton } from '@/components/follow-button'

type FollowState = 'none' | 'following' | 'friends'

interface UserSearchCardProps {
  user: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    followState: FollowState
  }
}

// Per D-03: avatar + username + Follow/Following/Friends button. No review count or bio.
export function UserSearchCard({ user }: UserSearchCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:border-accent transition-colors">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center overflow-hidden flex-shrink-0">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={`${user.username}'s avatar`}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-text-secondary text-sm font-medium">
            {user.username[0]?.toUpperCase() ?? '?'}
          </span>
        )}
      </div>

      {/* Username + display name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {user.displayName ?? user.username}
        </p>
        {user.displayName && (
          <p className="text-xs text-text-secondary truncate">@{user.username}</p>
        )}
      </div>

      {/* Follow button */}
      <FollowButton targetUserId={user.id} initialState={user.followState} />
    </div>
  )
}
