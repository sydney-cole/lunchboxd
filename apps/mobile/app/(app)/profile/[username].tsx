import React from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth, useUser } from '@clerk/expo'
import { colors, spacing, fontSizes, fontWeights } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

// Types matching API response from Plan 02
interface ProfileUser {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
}

interface ProfileStats {
  followerCount: string
  followingCount: string
  reviewCount: string
}

interface ProfileReview {
  id: string
  body: string | null
  rating: string | null
  photoUrl: string | null
  mealType: string
  mealDate: string | null
  createdAt: string
  tags: string[]
  restaurant: { name: string; address: string | null } | null
  likeCount: number
  isLikedByMe: boolean
}

// Shared ProfileContent component — rendered by both own tab and pushed screen
export function ProfileContent({ username }: { username: string }) {
  const router = useRouter()
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const queryClient = useQueryClient()
  const isOwner = clerkUser?.username === username

  // Fetch profile
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(`${API_BASE_URL}/api/v1/users/${username}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Profile not found')
      return res.json() as Promise<{ user: ProfileUser; stats: ProfileStats }>
    },
    staleTime: 60_000,
  })

  // Paginated reviews
  const {
    data: reviewsData,
    fetchNextPage,
    hasNextPage,
    isLoading: reviewsLoading,
  } = useInfiniteQuery<{ items: ProfileReview[]; nextCursor: string | null }>({
    queryKey: ['profile-reviews', username],
    queryFn: async ({ pageParam }) => {
      const token = await getToken()
      const url = pageParam
        ? `${API_BASE_URL}/api/v1/users/${username}/reviews?cursor=${encodeURIComponent(pageParam as string)}&limit=20`
        : `${API_BASE_URL}/api/v1/users/${username}/reviews`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load reviews')
      return res.json()
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  })

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async ({ reviewId }: { reviewId: string }) => {
      const token = await getToken()
      const res = await fetch(`${API_BASE_URL}/api/v1/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reviewId }),
      })
      if (!res.ok) throw new Error('Like failed')
      return res.json()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-reviews', username] })
    },
  })

  if (profileLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (profileError || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyHeading}>Profile not found</Text>
        <Text style={styles.emptyBody}>
          {"This account doesn't exist or may have been removed."}
        </Text>
      </View>
    )
  }

  const { user, stats } = profile
  const allReviews = reviewsData?.pages.flatMap((p) => p.items) ?? []

  const ListHeader = (
    <View>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {user.avatarUrl ? (
          <Image
            source={{ uri: user.avatarUrl }}
            style={styles.avatar}
            accessibilityLabel={`${user.username}'s avatar`}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{user.username[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
      </View>

      {/* Username + displayName */}
      <Text style={styles.username}>{user.username}</Text>
      {user.displayName ? <Text style={styles.displayName}>{user.displayName}</Text> : null}

      {/* Bio */}
      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Pressable
          onPress={() => router.push(`/followers/${user.username}`)}
          accessibilityLabel={`${stats.followerCount} followers`}
        >
          <Text style={styles.statsText}>{stats.followerCount} followers</Text>
        </Pressable>
        <Text style={styles.statsSeparator}> · </Text>
        <Pressable
          onPress={() => router.push(`/following/${user.username}`)}
          accessibilityLabel={`${stats.followingCount} following`}
        >
          <Text style={styles.statsText}>{stats.followingCount} following</Text>
        </Pressable>
      </View>

      {/* CTA: Edit Profile or Follow */}
      <View style={styles.ctaContainer}>
        {isOwner ? (
          <Pressable
            onPress={() => router.push('/profile/edit')}
            style={styles.editButton}
            accessibilityLabel="Edit profile"
          >
            <Text style={styles.editButtonText}>Edit profile</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.followButton}
            accessibilityLabel={`Follow ${user.username}`}
          >
            <Text style={styles.followButtonText}>Follow</Text>
          </Pressable>
        )}
      </View>

      {/* Reviews heading */}
      <Text style={styles.sectionHeading}>Reviews</Text>

      {/* Empty state */}
      {!reviewsLoading && allReviews.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyHeading}>No reviews yet</Text>
          <Text style={styles.emptyBody}>
            {isOwner
              ? 'Post your first meal to see it here.'
              : `${user.username} hasn't posted any reviews.`}
          </Text>
        </View>
      )}
    </View>
  )

  return (
    <FlatList
      data={allReviews}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={ListHeader}
      renderItem={({ item }) => (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewRating}>
            {item.rating
              ? `${'★'.repeat(Math.round(parseFloat(item.rating)))} ${item.rating}`
              : '—'}
          </Text>
          {item.body ? (
            <Text style={styles.reviewBody} numberOfLines={3}>
              {item.body}
            </Text>
          ) : null}
          {item.restaurant ? (
            <Text style={styles.reviewMeta}>{item.restaurant.name}</Text>
          ) : null}
          <Pressable
            onPress={() => likeMutation.mutate({ reviewId: item.id })}
            accessibilityLabel={item.isLikedByMe ? 'Unlike review' : 'Like review'}
          >
            <Text style={styles.reviewMeta}>{item.likeCount} likes</Text>
          </Pressable>
        </View>
      )}
      onEndReached={() => {
        if (hasNextPage) fetchNextPage()
      }}
      onEndReachedThreshold={0.5}
      contentContainerStyle={styles.listContent}
      style={styles.container}
    />
  )
}

// Default export: ProfileScreen for other users (pushed from feed/search/follow lists)
export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  return (
    <View style={styles.container}>
      <ProfileContent username={username} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  listContent: { paddingBottom: spacing.xl },
  avatarContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: {
    backgroundColor: `${colors.accent}33`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 28, fontWeight: '500', color: colors.accent },
  username: {
    textAlign: 'center',
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  displayName: {
    textAlign: 'center',
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bio: {
    textAlign: 'center',
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  statsText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  statsSeparator: { fontSize: fontSizes.sm, color: colors.textSecondary },
  ctaContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  editButton: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
  },
  followButton: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
  },
  sectionHeading: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyHeading: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  reviewCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewRating: { fontSize: fontSizes.sm, color: colors.accent, marginBottom: 4 },
  reviewBody: {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 4,
  },
  reviewMeta: { fontSize: fontSizes.sm, color: colors.textSecondary },
})
