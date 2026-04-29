import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useAuth } from '@clerk/expo'
import { useRouter } from 'expo-router'
import { MealTypeToggle } from '../../../components/meal-type-toggle'
import { StarRating } from '../../../components/star-rating'
import { RestaurantSearch } from '../../../components/restaurant-search'
import { PhotoPicker } from '../../../components/photo-picker'
import { TagInput } from '../../../components/tag-input'
import { colors, spacing } from '@lunchboxd/shared'
import type { CreateReviewInput } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

function getTodayDateString(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export default function ComposeScreen() {
  const router = useRouter()
  const { getToken } = useAuth()

  const [mealType, setMealType] = useState<'restaurant' | 'homemade'>('restaurant')
  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null)
  const [rating, setRating] = useState<number>(0)
  const [note, setNote] = useState<string>('')
  const [photoKey, setPhotoKey] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [mealDate, setMealDate] = useState<string>(getTodayDateString())

  const [ratingError, setRatingError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleMealTypeChange = (newType: 'restaurant' | 'homemade') => {
    setMealType(newType)
    if (newType === 'homemade') {
      setRestaurant(null)
    }
  }

  const handleSubmit = async () => {
    let hasError = false

    if (!rating || rating === 0) {
      setRatingError('Please add a rating.')
      hasError = true
    } else {
      setRatingError(null)
    }

    if (hasError) return

    setFormError(null)
    setIsSubmitting(true)

    const payload: CreateReviewInput = {
      mealType,
      restaurantId: mealType === 'restaurant' && restaurant ? restaurant.id : null,
      rating,
      note: note.trim() || undefined,
      photoKey: photoKey || null,
      tags,
      mealDate: mealDate || null,
    }

    try {
      const token = await getToken()
      const res = await fetch(`${API_BASE_URL}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Request failed')
      }

      // Navigate back to home after success
      router.replace('/(app)/(tabs)/')
    } catch {
      setFormError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const noteCount = note.length
  const showNoteCounter = noteCount >= 1500

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text style={styles.heading}>New Review</Text>

        {/* Meal type toggle */}
        <View style={styles.field}>
          <MealTypeToggle value={mealType} onChange={handleMealTypeChange} />
        </View>

        {/* Restaurant search — hidden when homemade */}
        {mealType === 'restaurant' && (
          <View style={styles.field}>
            <Text style={styles.label}>Restaurant</Text>
            <RestaurantSearch value={restaurant} onChange={setRestaurant} />
          </View>
        )}

        {/* Star rating */}
        <View style={styles.field}>
          <Text style={styles.label}>Rating</Text>
          <StarRating
            value={rating}
            onChange={(v) => {
              setRating(v)
              setRatingError(null)
            }}
          />
          {ratingError && (
            <Text style={styles.errorText}>{ratingError}</Text>
          )}
        </View>

        {/* Review note */}
        <View style={styles.field}>
          <Text style={styles.label}>What did you think?</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={4}
            maxLength={2000}
            placeholder="Write your thoughts..."
            placeholderTextColor={colors.textSecondary}
            textAlignVertical="top"
          />
          {showNoteCounter && (
            <Text style={styles.counterText}>{noteCount} / 2000</Text>
          )}
        </View>

        {/* Photo picker */}
        <View style={styles.field}>
          <Text style={styles.label}>Photo</Text>
          <PhotoPicker photoKey={photoKey} onPhotoChange={setPhotoKey} onGetToken={getToken} />
        </View>

        {/* Tag input */}
        <View style={styles.field}>
          <Text style={styles.label}>Tags</Text>
          <TagInput tags={tags} onChange={setTags} />
        </View>

        {/* Meal date */}
        <View style={styles.field}>
          <Text style={styles.label}>Meal date</Text>
          <TextInput
            style={styles.dateInput}
            value={mealDate}
            onChangeText={setMealDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </View>

        {/* Form-level error */}
        {formError && (
          <Text style={styles.formErrorText}>{formError}</Text>
        )}

        {/* Submit button */}
        <Pressable
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <View style={styles.submitButtonContent}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.submitButtonText}>Post Review</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Post Review</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  contentContainer: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 100,
  },
  counterText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  dateInput: {
    height: 44,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  submitButton: {
    height: 44,
    backgroundColor: colors.accent,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  errorText: {
    fontSize: 14,
    color: colors.destructive,
  },
  formErrorText: {
    fontSize: 14,
    color: colors.destructive,
    textAlign: 'center',
  },
})
