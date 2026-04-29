import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { colors, spacing } from '@lunchboxd/shared'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const commitTag = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, '').trim()
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setInputValue('')
  }

  const handleChangeText = (text: string) => {
    // If user types a comma, commit the tag
    if (text.endsWith(',')) {
      commitTag(text.slice(0, -1))
    } else {
      setInputValue(text)
    }
  }

  const handleSubmitEditing = () => {
    commitTag(inputValue)
  }

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index)
    onChange(newTags)
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={inputValue}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmitEditing}
        placeholder="Add tags..."
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        blurOnSubmit={false}
      />
      {tags.length > 0 && (
        <View style={styles.chipsContainer}>
          {tags.map((tag, index) => (
            <View key={index} style={styles.chip}>
              <Text style={styles.chipText}>{tag}</Text>
              <Pressable
                onPress={() => removeTag(index)}
                style={styles.removeButton}
                accessibilityLabel={`Remove tag ${tag}`}
              >
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    height: 44,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  chipText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  removeButton: {
    marginLeft: 4,
    paddingHorizontal: 2,
  },
  removeText: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 18,
  },
})
