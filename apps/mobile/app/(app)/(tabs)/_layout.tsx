import { Tabs, useRouter } from 'expo-router'
import { Pressable, View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/expo'
import { colors } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

function ProfileHeaderRight() {
  const router = useRouter()
  const { getToken } = useAuth()

  const { data } = useQuery<{ hasUnread: boolean }>({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(`${API_BASE_URL}/api/v1/notifications/unread`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const hasUnread = data?.hasUnread ?? false

  return (
    <Pressable
      onPress={() => router.push('/(app)/notifications')}
      style={styles.bellButton}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
      {hasUnread && <View style={styles.unreadDot} />}
    </Pressable>
  )
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="compose" options={{ title: 'New Review' }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: true,
          headerRight: () => <ProfileHeaderRight />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  bellButton: {
    marginRight: 16,
    position: 'relative',
    padding: 4,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.destructive,
  },
})
