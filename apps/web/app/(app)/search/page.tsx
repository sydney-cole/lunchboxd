'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserSearchCard } from '@/components/user-search-card'

type FollowState = 'none' | 'following' | 'friends'

interface UserSearchResult {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  followState: FollowState
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce: 300ms delay, minimum 2 characters
  useEffect(() => {
    if (query.length < 2) {
      setDebouncedQuery('')
      return
    }
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results, isLoading } = useQuery<UserSearchResult[]>({
    queryKey: ['user-search', debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/v1/users/search?q=${encodeURIComponent(debouncedQuery)}`)
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-text-primary mb-4">Find People</h1>

      {/* Search input (per D-02: simple text input) */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by username or name..."
        className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        autoFocus
      />

      {/* Results */}
      <div className="mt-4 space-y-2">
        {query.length === 1 && (
          <p className="text-sm text-text-secondary text-center py-4">Keep typing to search…</p>
        )}

        {isLoading && debouncedQuery.length >= 2 && (
          <p className="text-sm text-text-secondary text-center py-4">Searching...</p>
        )}

        {!isLoading && results && results.length === 0 && debouncedQuery.length >= 2 && (
          <p className="text-sm text-text-secondary text-center py-4">
            No users found for &ldquo;{debouncedQuery}&rdquo;
          </p>
        )}

        {results &&
          results.map((user) => <UserSearchCard key={user.id} user={user} />)}
      </div>
    </div>
  )
}
