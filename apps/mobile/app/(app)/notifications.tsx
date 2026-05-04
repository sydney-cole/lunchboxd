import React, { useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import { colors } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

interface NotificationItem {
  id: string
  type: string
  read: boolean
  createdAt: string
  actor: { username: string; avatarUrl: string | null } | null
  reviewId: string | null
  restaurantName: string | null
}

interface NotificationsResponse {
  items: NotificationItem[]
  nextCursor: string | null
}

// Hand-rolled relative time — same implementation as feed index.tsx
function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const actionText = item.type === 'follow'
    ? 'followed you'
    : `liked your review of ${item.restaurantName ?? 'your homemade meal'}`

  return (
    <View style={[rowStyles.row, item.read ? null : rowStyles.unreadRow]}>
      {item.actor?.avatarUrl ? (
        <Image source={{ uri: item.actor.avatarUrl }} style={rowStyles.avatar} />
      ) : (
        <View style={rowStyles.avatarFallback}>
          <Text style={rowStyles.avatarInitial}>
            {(item.actor?.username ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <Text style={rowStyles.actionText} numberOfLines={2}>
        <Text style={rowStyles.username}>@{item.actor?.username ?? 'unknown'}</Text>
        {' '}{actionText}
        {' \u00b7 '}{formatRelativeTime(item.createdAt)}
      </Text>
    </View>
  )
}

export default function NotificationsScreen() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam }) => {
      const token = await getToken()
      const url = pageParam
        ? `${API_BASE_URL}/api/v1/notifications?cursor=${encodeURIComponent(pageParam as string)}`
        : `${API_BASE_URL}/api/v1/notifications`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load notifications')
      return res.json() as Promise<NotificationsResponse>
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  })

  // D-04 behavior on mobile: fire read-all when screen mounts, invalidate unread badge
  useEffect(() => {
    const markRead = async () => {
      const token = await getToken()
      await fetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    }
    markRead()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const allItems = data?.pages.flatMap(page => page.items) ?? []

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load notifications. Pull down to retry.</Text>
      </View>
    )
  }

  if (allItems.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyHeading}>No notifications yet</Text>
        <Text style={styles.emptyBody}>
          {'When someone follows you or likes a review, you\'ll see it here.'}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationRow item={item} />}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage
            ? <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 16 }} />
            : !hasNextPage && allItems.length > 0
              ? <Text style={styles.allCaughtUp}>All caught up.</Text>
              : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  emptyHeading: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  errorText: { fontSize: 14, color: colors.destructive, textAlign: 'center' },
  allCaughtUp: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 16, fontSize: 14 },
})

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  unreadRow: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  avatarFallback: {
    width: 32, height: 32, borderRadius: 16, marginRight: 8,
    backgroundColor: `${colors.accent}33`,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 11, color: colors.accent, fontWeight: '500' },
  actionText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  username: { fontWeight: '600', color: colors.textPrimary },
})
