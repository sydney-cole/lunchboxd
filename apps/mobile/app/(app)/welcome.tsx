import { useUser } from '@clerk/expo'
import { router } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, fontSizes, fontWeights, spacing, radii } from '@lunchboxd/shared'

export default function WelcomeScreen() {
  const { user } = useUser()
  const username = user?.username || user?.firstName || 'there'

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        Welcome to Lunchboxd, @{username}
      </Text>
      <Text style={styles.body}>
        Lunchboxd is your personal food diary. Log every meal, follow friends, and see what your people are eating.
      </Text>

      <View style={styles.ctaGroup}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(app)/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Log your first meal"
        >
          <Text style={styles.primaryButtonText}>Log your first meal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => router.replace('/(app)/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Find friends to follow"
        >
          <Text style={styles.outlineButtonText}>Find friends to follow</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  body: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing['2xl'],
    maxWidth: 320,
  },
  ctaGroup: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'stretch',
  },
  primaryButton: {
    height: 44,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  outlineButton: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
})
