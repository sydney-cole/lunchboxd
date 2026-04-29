import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, spacing } from '@lunchboxd/shared'

interface MealTypeToggleProps {
  value: 'restaurant' | 'homemade'
  onChange: (v: 'restaurant' | 'homemade') => void
}

export function MealTypeToggle({ value, onChange }: MealTypeToggleProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, value === 'restaurant' && styles.buttonActive]}
        onPress={() => onChange('restaurant')}
        activeOpacity={0.8}
      >
        <Text style={[styles.text, value === 'restaurant' && styles.textActive]}>
          Restaurant
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, value === 'homemade' && styles.buttonActive]}
        onPress={() => onChange('homemade')}
        activeOpacity={0.8}
      >
        <Text style={[styles.text, value === 'homemade' && styles.textActive]}>
          Homemade
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  buttonActive: {
    backgroundColor: colors.accent,
  },
  text: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  textActive: {
    color: colors.white,
    fontWeight: '600',
  },
})
