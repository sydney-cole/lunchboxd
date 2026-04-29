import React, { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { colors, spacing } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

interface Restaurant {
  id: string
  name: string
  address?: string | null
}

interface RestaurantSearchProps {
  value: { id: string; name: string } | null
  onChange: (v: { id: string; name: string } | null) => void
}

export function RestaurantSearch({ value, onChange }: RestaurantSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Restaurant[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/restaurants/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) {
        setError('Restaurant search unavailable. Add the name manually.')
        setResults([])
      } else {
        const data: Restaurant[] = await res.json()
        setResults(data)
      }
      setHasSearched(true)
    } catch {
      setError('Restaurant search unavailable. Add the name manually.')
      setResults([])
      setHasSearched(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query || query.length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      search(query)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    onChange({ id: restaurant.id, name: restaurant.name })
    setQuery('')
    setResults([])
    setHasSearched(false)
  }

  const handleAddManually = async () => {
    if (!query.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/restaurants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query.trim() }),
      })
      if (res.ok) {
        const restaurant: Restaurant = await res.json()
        onChange({ id: restaurant.id, name: restaurant.name })
      } else {
        onChange({ id: `manual-${Date.now()}`, name: query.trim() })
      }
    } catch {
      onChange({ id: `manual-${Date.now()}`, name: query.trim() })
    } finally {
      setIsLoading(false)
      setQuery('')
      setResults([])
      setHasSearched(false)
    }
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
    setResults([])
    setHasSearched(false)
    setError(null)
  }

  const showManually = hasSearched && results.length === 0 && query.length >= 2 && !error
  const showDropdown = (results.length > 0 || showManually || !!error)

  // Show selected state
  if (value) {
    return (
      <View style={styles.selectedContainer}>
        <Text style={styles.selectedText} numberOfLines={1}>{value.name}</Text>
        <Pressable onPress={handleClear} accessibilityLabel="Clear restaurant selection">
          <Text style={styles.clearText}>×</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a restaurant..."
          placeholderTextColor={colors.textSecondary}
          autoCorrect={false}
        />
        {isLoading && (
          <ActivityIndicator
            style={styles.loadingIndicator}
            size="small"
            color={colors.textSecondary}
          />
        )}
      </View>

      {showDropdown && (
        <ScrollView
          style={styles.dropdown}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              {results.slice(0, 5).map((restaurant) => (
                <Pressable
                  key={restaurant.id}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectRestaurant(restaurant)}
                >
                  <Text style={styles.dropdownItemName}>{restaurant.name}</Text>
                  {restaurant.address && (
                    <Text style={styles.dropdownItemAddress}>{restaurant.address}</Text>
                  )}
                </Pressable>
              ))}
              {showManually && (
                <Pressable
                  style={styles.dropdownItem}
                  onPress={handleAddManually}
                >
                  <Text style={styles.addManuallyText}>+ Add "{query}" manually</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    height: '100%',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  dropdown: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 220,
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  dropdownItemName: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  dropdownItemAddress: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  addManuallyText: {
    fontSize: 14,
    color: colors.accent,
  },
  errorText: {
    fontSize: 14,
    color: colors.destructive,
    padding: spacing.md,
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
  },
  selectedText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  clearText: {
    fontSize: 20,
    color: colors.textSecondary,
    marginLeft: 8,
    lineHeight: 22,
  },
})
