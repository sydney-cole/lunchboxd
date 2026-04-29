import { useState, useEffect } from 'react'
import { View, Text, TextInput, ScrollView } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import { UserSearchCard } from '../../../components/user-search-card'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

type FollowState = 'none' | 'following' | 'friends'

interface UserSearchResult {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  followState: FollowState
}

export default function SearchScreen() {
  const { getToken } = useAuth()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

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
      // CRITICAL: getToken() inside queryFn (Pitfall 6)
      const token = await getToken()
      const res = await fetch(
        `${API_BASE_URL}/api/v1/users/search?q=${encodeURIComponent(debouncedQuery)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 16, paddingTop: 48 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 }}>
        Find People
      </Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by username or name..."
        style={{
          width: '100%',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#d1d5db',
          backgroundColor: '#ffffff',
          color: '#111827',
          fontSize: 16,
        }}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#9ca3af"
      />

      <ScrollView style={{ marginTop: 16 }} keyboardShouldPersistTaps="handled">
        {isLoading && debouncedQuery.length >= 2 && (
          <Text
            style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', paddingVertical: 16 }}
          >
            Searching...
          </Text>
        )}

        {results && results.length === 0 && debouncedQuery.length >= 2 && (
          <Text
            style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', paddingVertical: 16 }}
          >
            No users found
          </Text>
        )}

        {results?.map((user) => (
          <UserSearchCard key={user.id} user={user} />
        ))}
      </ScrollView>
    </View>
  )
}
