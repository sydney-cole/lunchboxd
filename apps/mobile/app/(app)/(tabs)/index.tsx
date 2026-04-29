import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

interface ReviewWithLike {
  id: string
  rating: number
  note: string | null
  mealDate: string | null
  likeCount: number
  isLikedByMe: boolean
  restaurant?: { name: string } | null
  mealType: 'restaurant' | 'homemade'
}

export default function HomeScreen() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const { data: reviews, isLoading, isError } = useQuery<ReviewWithLike[]>({
    queryKey: ['my-reviews'],
    queryFn: async () => {
      // CRITICAL: getToken() inside queryFn (Pitfall 6)
      const token = await getToken()
      const res = await fetch(`${API_BASE_URL}/api/v1/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load reviews')
      return res.json()
    },
    staleTime: 60_000,
  })

  const likeMutation = useMutation({
    mutationFn: async ({ reviewId }: { reviewId: string }) => {
      // CRITICAL: getToken() inside mutationFn (Pitfall 6)
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
      await queryClient.cancelQueries({ queryKey: ['my-reviews'] })
      const previousReviews = queryClient.getQueryData<ReviewWithLike[]>(['my-reviews'])
      queryClient.setQueryData<ReviewWithLike[]>(['my-reviews'], (old) =>
        old?.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                isLikedByMe: !r.isLikedByMe,
                likeCount: r.isLikedByMe ? r.likeCount - 1 : r.likeCount + 1,
              }
            : r
        )
      )
      return { previousReviews }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousReviews) {
        queryClient.setQueryData(['my-reviews'], context.previousReviews)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
    },
  })

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
        <Text style={styles.errorText}>Failed to load reviews</Text>
      </View>
    )
  }

  if (!reviews || reviews.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.heading}>Lunchboxd</Text>
        <Text style={styles.subtitle}>No reviews yet. Compose your first one!</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Reviews</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {reviews.map((review) => (
          <View key={review.id} style={styles.card}>
            {/* Meal name / type */}
            <Text style={styles.mealName}>
              {review.restaurant?.name ?? (review.mealType === 'homemade' ? 'Homemade meal' : 'Meal')}
            </Text>

            {/* Rating */}
            <Text style={styles.rating}>
              {'★'.repeat(Math.floor(review.rating))}
              {review.rating % 1 !== 0 ? '½' : ''}
              {'☆'.repeat(5 - Math.ceil(review.rating))}
            </Text>

            {/* Note */}
            {review.note ? (
              <Text style={styles.note} numberOfLines={3}>
                {review.note}
              </Text>
            ) : null}

            {/* Meal date */}
            {review.mealDate ? (
              <Text style={styles.date}>{review.mealDate}</Text>
            ) : null}

            {/* Like button */}
            <View style={styles.likeSeparator} />
            <Pressable
              onPress={() => likeMutation.mutate({ reviewId: review.id })}
              style={styles.likeRow}
            >
              <Ionicons
                name={review.isLikedByMe ? 'heart' : 'heart-outline'}
                size={18}
                color={review.isLikedByMe ? '#ef4444' : '#6b7280'}
              />
              <Text style={styles.likeCount}>{review.likeCount ?? 0}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
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
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 16,
    color: colors.destructive,
  },
  list: {
    gap: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
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
    color: '#9ca3af',
    marginTop: 4,
  },
  likeSeparator: {
    height: 1,
    backgroundColor: '#f3f4f6',
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
    color: '#6b7280',
  },
})
