import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native'
import { useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

interface FeedAuthor {
  id: string
  username: string
  avatarUrl: string | null
}

interface FeedItem {
  id: string
  body: string | null
  rating: string | null
  photoUrl: string | null
  mealType: string
  mealDate: string | null
  createdAt: string
  feedCreatedAt: string
  tags: string[]
  restaurant: { id: string; name: string; address: string | null } | null
  likeCount: number
  isLikedByMe: boolean
  author: FeedAuthor | null
  isOwnReview: boolean
}

interface FeedResponse {
  items: FeedItem[]
  nextCursor: string | null
}

// Hand-rolled relative time — mirrors apps/web/lib/utils.ts formatRelativeTime
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

// Inline FeedCard component
function FeedCard({
  item,
  onLike,
}: {
  item: FeedItem
  onLike: (id: string) => void
}) {
  const ratingValue = item.rating ? parseFloat(item.rating) : 0
  const mealName =
    item.mealType === 'homemade'
      ? 'Homemade meal'
      : item.restaurant?.name ?? 'Unknown Restaurant'

  return (
    <View style={cardStyles.card}>
      {/* Author row */}
      {item.author && (
        <View style={cardStyles.authorRow}>
          {item.author.avatarUrl ? (
            <Image
              source={{ uri: item.author.avatarUrl }}
              style={cardStyles.avatar}
            />
          ) : (
            <View style={cardStyles.avatarFallback}>
              <Text style={cardStyles.avatarInitial}>
                {item.author.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={cardStyles.authorText}>
            @{item.author.username} · {formatRelativeTime(item.createdAt)}
          </Text>
        </View>
      )}
      <View style={cardStyles.authorDivider} />

      {/* Meal name */}
      <Text style={cardStyles.mealName}>{mealName}</Text>

      {/* Rating stars */}
      <Text style={cardStyles.rating}>
        {'★'.repeat(Math.floor(ratingValue))}
        {ratingValue % 1 !== 0 ? '½' : ''}
        {'☆'.repeat(5 - Math.ceil(ratingValue))}
      </Text>

      {/* Note */}
      {item.body ? (
        <Text style={cardStyles.note} numberOfLines={3}>
          {item.body}
        </Text>
      ) : null}

      {/* Meal date */}
      {item.mealDate ? (
        <Text style={cardStyles.date}>{item.mealDate}</Text>
      ) : null}

      {/* Like button */}
      <View style={cardStyles.likeSeparator} />
      <Pressable
        onPress={() => onLike(item.id)}
        style={cardStyles.likeRow}
        accessibilityLabel={item.isLikedByMe ? 'Unlike review' : 'Like review'}
      >
        <Ionicons
          name={item.isLikedByMe ? 'heart' : 'heart-outline'}
          size={18}
          color={item.isLikedByMe ? colors.destructive : colors.textSecondary}
        />
        <Text style={cardStyles.likeCount}>{item.likeCount ?? 0}</Text>
      </Pressable>
    </View>
  )
}

export default function FeedScreen() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useInfiniteQuery<FeedResponse>({
    queryKey: ['feed'],
    queryFn: async ({ pageParam }) => {
      // CRITICAL: getToken() inside queryFn (not at component level)
      const token = await getToken()
      const url = pageParam
        ? `${API_BASE_URL}/api/v1/feed?cursor=${encodeURIComponent(pageParam as string)}&limit=20`
        : `${API_BASE_URL}/api/v1/feed`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load feed')
      return res.json() as Promise<FeedResponse>
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  })

  // Like mutation — targets ['feed'] query key, NOT ['my-reviews']
  const likeMutation = useMutation({
    mutationFn: async ({ reviewId }: { reviewId: string }) => {
      // CRITICAL: getToken() inside mutationFn
      const token = await getToken()
      const res = await fetch(`${API_BASE_URL}/api/v1/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewId }),
      })
      if (!res.ok) throw new Error('Like failed')
      return res.json() as Promise<{ liked: boolean; likeCount: number }>
    },
    onMutate: async ({ reviewId }) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] })
      const previousData = queryClient.getQueryData<InfiniteData<FeedResponse>>(['feed'])
      queryClient.setQueryData<InfiniteData<FeedResponse>>(['feed'], (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === reviewId
                ? {
                    ...item,
                    isLikedByMe: !item.isLikedByMe,
                    likeCount: item.isLikedByMe ? item.likeCount - 1 : item.likeCount + 1,
                  }
                : item
            ),
          })),
        }
      })
      return { previousData }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['feed'], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  const allItems = data?.pages.flatMap((page) => page.items) ?? []

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
        <Text style={styles.errorHeading}>{"Couldn't load your feed"}</Text>
        <Text style={styles.errorBody}>
          Something went wrong. Pull down to try again.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Feed</Text>
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedCard
            item={item}
            onLike={(id) => likeMutation.mutate({ reviewId: id })}
          />
        )}
        contentContainerStyle={allItems.length === 0 ? styles.emptyContainer : styles.list}
        // Pull-to-refresh — per D-10
        refreshing={isLoading || isFetching}
        onRefresh={() => refetch()}
        // Pagination — onEndReached fires when 30% from bottom
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage()
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              style={styles.footerLoader}
            />
          ) : !hasNextPage && allItems.length > 0 ? (
            <Text style={styles.endOfFeed}>{"You're all caught up."}</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyHeading}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>
              Follow people to see their meals here.
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  errorHeading: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
    paddingHorizontal: 24,
  },
  emptyHeading: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerLoader: {
    marginVertical: 16,
  },
  endOfFeed: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
})

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  authorText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  authorDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    color: '#f59e0b',
    marginBottom: 6,
  },
  note: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  likeSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 12,
    marginBottom: 8,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
})
