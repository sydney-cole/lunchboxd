import React from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import { UserSearchCard } from '../../../components/user-search-card'
import { colors, spacing, fontSizes, fontWeights } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

type FollowState = 'none' | 'following' | 'friends'

interface UserCard {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  followState: FollowState
}

export default function FollowingScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const { getToken } = useAuth()

  const { data: users, isLoading } = useQuery<UserCard[]>({
    queryKey: ['following', username],
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(`${API_BASE_URL}/api/v1/users/${encodeURIComponent(username)}/following`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load following')
      return res.json()
    },
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (!users || users.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyHeading}>Not following anyone yet</Text>
        <Text style={styles.emptyBody}>Search for friends to follow.</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <UserSearchCard user={item} />}
      style={styles.container}
      contentContainerStyle={styles.listContent}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing.md },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  emptyHeading: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyBody: { fontSize: fontSizes.md, color: colors.textSecondary, textAlign: 'center' },
})
