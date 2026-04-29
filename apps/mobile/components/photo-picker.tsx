import React, { useState } from 'react'
import { View, Text, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { colors, spacing } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

interface PhotoPickerProps {
  photoKey: string | null
  onPhotoChange: (key: string | null) => void
}

export function PhotoPicker({ photoKey, onPhotoChange }: PhotoPickerProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUri, setPreviewUri] = useState<string | null>(null)

  const handlePress = async () => {
    setUploadError(null)

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return
    }

    const asset = result.assets[0]
    setPreviewUri(asset.uri)
    setIsUploading(true)

    try {
      // 1. Get presigned upload URL
      const contentType = asset.mimeType ?? 'image/jpeg'
      const uploadRes = await fetch(`${API_BASE_URL}/api/v1/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType }),
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to get upload URL')
      }

      const { uploadUrl, key } = await uploadRes.json() as { uploadUrl: string; key: string }

      // 2. Fetch blob from local URI and PUT to presigned URL
      const fileResponse = await fetch(asset.uri)
      const blob = await fileResponse.blob()

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      })

      if (!putRes.ok) {
        throw new Error('Failed to upload photo')
      }

      onPhotoChange(key)
    } catch (err) {
      setUploadError('Photo upload failed. Please try again.')
      setPreviewUri(null)
      onPhotoChange(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = () => {
    setPreviewUri(null)
    setUploadError(null)
    onPhotoChange(null)
  }

  if (previewUri || photoKey) {
    return (
      <View style={styles.previewContainer}>
        {previewUri && (
          <Image source={{ uri: previewUri }} style={styles.thumbnail} />
        )}
        {isUploading && (
          <ActivityIndicator
            style={styles.uploadingOverlay}
            size="small"
            color={colors.accent}
          />
        )}
        {!isUploading && (
          <Pressable onPress={handleRemove} style={styles.removeButton} accessibilityLabel="Remove photo">
            <Text style={styles.removeText}>× Remove</Text>
          </Pressable>
        )}
        {uploadError && (
          <Text style={styles.errorText}>{uploadError}</Text>
        )}
      </View>
    )
  }

  return (
    <View>
      <Pressable onPress={handlePress} style={styles.picker}>
        <Text style={styles.cameraIcon}>📷</Text>
        <Text style={styles.pickerText}>Add photo</Text>
      </Pressable>
      {uploadError && (
        <Text style={styles.errorText}>{uploadError}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  picker: {
    height: 80,
    width: '100%',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
  },
  cameraIcon: {
    fontSize: 20,
  },
  pickerText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  uploadingOverlay: {
    flex: 1,
  },
  removeButton: {
    flex: 1,
  },
  removeText: {
    fontSize: 14,
    color: colors.destructive,
  },
  errorText: {
    fontSize: 14,
    color: colors.destructive,
    marginTop: 4,
  },
})
