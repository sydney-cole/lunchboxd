'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { UserSearchCard } from '@/components/user-search-card'

type FollowState = 'none' | 'following' | 'friends'

interface UserCard {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  followState: FollowState
}

export default function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = use(params)  // Client Component: use React.use() not await
  const { getToken } = useAuth()

  const { data: users, isLoading, isError } = useQuery<UserCard[]>({
    queryKey: ['followers', username],
    queryFn: async () => {
      const token = await getToken()
      const headers: HeadersInit = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/v1/users/${username}/followers`, { headers })
      if (!res.ok) throw new Error('Failed to load followers')
      return res.json()
    },
    staleTime: 30_000,
  })

  return (
    <div className="min-h-screen bg-bg py-6 px-4">
      <div className="w-full max-w-[600px] mx-auto">
        <a
          href={`/@${username}`}
          className="text-[14px] text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent rounded mb-6 inline-block"
        >
          ← @{username}&apos;s followers
        </a>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-text-secondary" />
          </div>
        )}

        {isError && (
          <p className="text-[16px] text-text-secondary text-center py-12">
            Failed to load followers.
          </p>
        )}

        {!isLoading && users && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[20px] font-semibold text-text-primary mb-2">No followers yet</p>
            <p className="text-[16px] text-text-secondary">Share your profile to find people to follow you.</p>
          </div>
        )}

        {users && users.length > 0 && (
          <div className="flex flex-col gap-2 mt-4">
            {users.map((user) => (
              <UserSearchCard key={user.id} user={user} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
