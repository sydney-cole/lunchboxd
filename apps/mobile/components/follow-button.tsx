import { Pressable, Text } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'

type FollowState = 'none' | 'following' | 'friends'

interface FollowButtonProps {
  targetUserId: string
  initialState: FollowState
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export function FollowButton({ targetUserId, initialState }: FollowButtonProps) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const followMutation = useMutation({
    mutationFn: async ({ action }: { action: 'follow' | 'unfollow' }) => {
      // CRITICAL: getToken() inside mutationFn, never cached (Pitfall 6)
      const token = await getToken()
      const res = await fetch(`${API_BASE_URL}/api/v1/follows`, {
        method: action === 'follow' ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId }),
      })
      if (!res.ok) throw new Error('Follow action failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-search'] })
    },
  })

  const label =
    initialState === 'friends'
      ? 'Friends'
      : initialState === 'following'
        ? 'Following'
        : 'Follow'

  const isFollowing = initialState !== 'none'

  return (
    <Pressable
      onPress={() => followMutation.mutate({ action: isFollowing ? 'unfollow' : 'follow' })}
      disabled={followMutation.isPending}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: isFollowing ? 'transparent' : '#3b82f6',
        borderWidth: isFollowing ? 1 : 0,
        borderColor: isFollowing ? '#d1d5db' : undefined,
        opacity: followMutation.isPending ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '500',
          color: isFollowing ? '#111827' : '#ffffff',
        }}
      >
        {followMutation.isPending ? '...' : label}
      </Text>
    </Pressable>
  )
}
