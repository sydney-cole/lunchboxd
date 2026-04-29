import React, { useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors } from '@lunchboxd/shared'

interface StarRatingProps {
  value: number
  onChange: (v: number) => void
  readOnly?: boolean
}

const STAR_SIZE = 32
const STAR_PATH =
  'M16 2.5L19.708 11.854L29.708 12.639L22.382 18.946L24.702 28.721L16 23.5L7.298 28.721L9.618 18.946L2.292 12.639L12.292 11.854L16 2.5Z'

function StarIcon({ filled, halfFilled }: { filled: boolean; halfFilled: boolean }) {
  // Use Text-based star since react-native-svg may not be available
  // Full star: filled accent, half: mix, empty: border
  const starChar = '★'
  if (filled) {
    return (
      <Text style={[styles.starChar, { color: '#F97316' }]}>{starChar}</Text>
    )
  }
  if (halfFilled) {
    return (
      <View style={styles.halfStarContainer}>
        <View style={styles.halfStarLeft}>
          <Text style={[styles.starChar, { color: '#F97316' }]}>{starChar}</Text>
        </View>
        <View style={styles.halfStarRight}>
          <Text style={[styles.starChar, { color: '#E7D5C5' }]}>{starChar}</Text>
        </View>
      </View>
    )
  }
  return (
    <Text style={[styles.starChar, { color: '#E7D5C5' }]}>{starChar}</Text>
  )
}

export function StarRating({ value, onChange, readOnly = false }: StarRatingProps) {
  const handleHalfPress = useCallback(
    (starIndex: number, isLeft: boolean) => {
      if (readOnly) return
      const newValue = isLeft ? starIndex - 0.5 : starIndex
      onChange(newValue)
    },
    [readOnly, onChange]
  )

  const renderStar = (starIndex: number) => {
    const filled = value >= starIndex
    const halfFilled = !filled && value >= starIndex - 0.5

    return (
      <View key={starIndex} style={styles.starWrapper}>
        <StarIcon filled={filled} halfFilled={halfFilled} />
        {!readOnly && (
          <>
            {/* Left half — X.5 stars */}
            <Pressable
              style={styles.leftZone}
              onPress={() => handleHalfPress(starIndex, true)}
              accessibilityLabel={`${starIndex - 0.5} stars`}
            />
            {/* Right half — X.0 stars */}
            <Pressable
              style={styles.rightZone}
              onPress={() => handleHalfPress(starIndex, false)}
              accessibilityLabel={`${starIndex} stars`}
            />
          </>
        )}
      </View>
    )
  }

  const stars = [1, 2, 3, 4, 5]

  return (
    <View style={styles.container}>
      <View style={styles.starsRow}>
        {stars.map(renderStar)}
      </View>
      <Text style={styles.label}>
        {value > 0 ? `${value} / 5` : '— / 5'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingVertical: 6,
  },
  starWrapper: {
    width: STAR_SIZE,
    height: STAR_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starChar: {
    fontSize: STAR_SIZE,
    lineHeight: STAR_SIZE + 4,
  },
  halfStarContainer: {
    width: STAR_SIZE,
    height: STAR_SIZE + 4,
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'center',
  },
  halfStarLeft: {
    width: STAR_SIZE / 2,
    overflow: 'hidden',
  },
  halfStarRight: {
    width: STAR_SIZE / 2,
    overflow: 'hidden',
  },
  leftZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
    height: '100%',
  },
  rightZone: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '50%',
    height: '100%',
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
  },
})
