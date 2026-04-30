import { View, StyleSheet } from 'react-native'
import { useUser } from '@clerk/expo'
import { colors } from '@lunchboxd/shared'
import { ProfileContent } from '../profile/[username]'

export default function OwnProfileTab() {
  const { user: clerkUser, isLoaded } = useUser()

  if (!isLoaded || !clerkUser?.username) {
    return <View style={styles.container} />
  }

  return <ProfileContent username={clerkUser.username} />
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
})
