import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth, useUser } from '@clerk/expo'
import { useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { colors, spacing, fontSizes, fontWeights } from '@lunchboxd/shared'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export default function EditProfileScreen() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const queryClient = useQueryClient()

  const [bio, setBio] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarKey, setAvatarKey] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Pre-fill from API on first render
  if (!initialized && clerkUser?.username) {
    setInitialized(true)
    getToken().then((token) => {
      fetch(`${API_BASE_URL}/api/v1/users/${clerkUser.username}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.user?.bio) setBio(data.user.bio)
          if (data.user?.displayName) setDisplayName(data.user.displayName)
        })
        .catch(() => {})
    })
  }

  async function handlePickAvatar() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      })
      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      const contentType = asset.mimeType ?? 'image/jpeg'

      setIsUploadingAvatar(true)
      const token = await getToken()

      // Step 1: Get presigned upload URL
      const uploadRes = await fetch(`${API_BASE_URL}/api/v1/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentType, type: 'avatar' }),
      })
      if (!uploadRes.ok) throw new Error('Upload setup failed')
      const { uploadUrl, key } = (await uploadRes.json()) as { uploadUrl: string; key: string }

      // Step 2: Upload file to R2 directly
      const fileRes = await fetch(asset.uri)
      const blob = await fileRes.blob()
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': contentType },
      })
      if (!putRes.ok) throw new Error('Upload to storage failed')

      setAvatarKey(key)
      Alert.alert('Avatar updated', 'Your photo will be saved when you tap Save.')
    } catch {
      Alert.alert('Upload failed', 'Photo upload failed. Try a different image.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  async function handleSave() {
    setSaveError(null)
    setIsSaving(true)

    try {
      const token = await getToken()
      const body: Record<string, string | undefined> = {}
      if (bio !== undefined) body.bio = bio
      if (displayName !== undefined) body.displayName = displayName
      if (avatarKey) body.avatarKey = avatarKey

      const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        setSaveError('Failed to save changes. Please try again.')
        return
      }

      queryClient.invalidateQueries({ queryKey: ['profile', clerkUser?.username] })
      router.back()
    } catch {
      setSaveError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Edit Profile</Text>

      {/* Avatar upload */}
      <Pressable
        onPress={handlePickAvatar}
        style={styles.avatarButton}
        disabled={isUploadingAvatar}
        accessibilityLabel="Upload profile photo"
      >
        {isUploadingAvatar ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.avatarButtonText}>Upload photo</Text>
        )}
      </Pressable>
      {avatarKey && (
        <Text style={styles.avatarSuccess}>Photo selected — will save with profile.</Text>
      )}

      {/* Display name */}
      <Text style={styles.label}>Display name</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your display name"
        placeholderTextColor={colors.textSecondary}
        maxLength={50}
        style={styles.input}
        returnKeyType="next"
        accessibilityLabel="Display name"
      />

      {/* Bio */}
      <Text style={styles.label}>Bio</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        placeholder="Write a short bio..."
        placeholderTextColor={colors.textSecondary}
        maxLength={500}
        style={[styles.input, styles.bioInput]}
        multiline
        numberOfLines={4}
        returnKeyType="done"
        accessibilityLabel="Bio"
      />

      {/* Save button */}
      <Pressable
        onPress={handleSave}
        disabled={isSaving}
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        accessibilityLabel="Save changes"
      >
        {isSaving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.saveButtonText}>Save changes</Text>
        )}
      </Pressable>

      {saveError && <Text style={styles.error}>{saveError}</Text>}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  heading: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  avatarButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  avatarButtonText: { fontSize: fontSizes.md, color: colors.accent },
  avatarSuccess: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
  },
  bioInput: { minHeight: 96, textAlignVertical: 'top' },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    marginTop: spacing.sm,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
  },
  error: {
    color: '#EF4444',
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
})
