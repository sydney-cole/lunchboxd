import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@lunchboxd/shared'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Lunchboxd</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
})
