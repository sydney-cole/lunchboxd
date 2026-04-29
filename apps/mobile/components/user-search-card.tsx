import { View, Text, Image } from 'react-native'
import { FollowButton } from './follow-button'

type FollowState = 'none' | 'following' | 'friends'

interface UserSearchCardProps {
  user: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    followState: FollowState
  }
}

export function UserSearchCard({ user }: UserSearchCardProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#ffffff',
        marginBottom: 8,
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#f3f4f6',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {user.avatarUrl ? (
          <Image
            source={{ uri: user.avatarUrl }}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
        ) : (
          <Text style={{ color: '#6b7280', fontSize: 14, fontWeight: '500' }}>
            {user.username[0]?.toUpperCase() ?? '?'}
          </Text>
        )}
      </View>

      {/* Name */}
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 14, fontWeight: '500', color: '#111827' }}
          numberOfLines={1}
        >
          {user.displayName ?? user.username}
        </Text>
        {user.displayName && (
          <Text style={{ fontSize: 12, color: '#6b7280' }} numberOfLines={1}>
            @{user.username}
          </Text>
        )}
      </View>

      {/* Follow button */}
      <FollowButton targetUserId={user.id} initialState={user.followState} />
    </View>
  )
}
