import { useSignUp, useAuth, useClerk } from '@clerk/expo'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native'
import { colors, fontSizes, fontWeights, spacing, radii } from '@lunchboxd/shared'
import { signUpSchema } from '@lunchboxd/shared'
import { createApiClient } from '@lunchboxd/shared'

export default function SignUpScreen() {
  const { signUp } = useSignUp()
  const { getToken } = useAuth()
  const clerk = useClerk()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string }>({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  function validateField(field: 'username' | 'email' | 'password', value: string) {
    const partial = field === 'username'
      ? { username: value, email: email || 'placeholder@x.com', password: password || 'placeholder123' }
      : field === 'email'
      ? { username: username || 'placeholder', email: value, password: password || 'placeholder123' }
      : { username: username || 'placeholder', email: email || 'placeholder@x.com', password: value }

    const result = signUpSchema.safeParse(partial)
    if (!result.success) {
      const fieldError = result.error.issues.find((i) => i.path[0] === field)
      setErrors((prev) => ({ ...prev, [field]: fieldError ? fieldError.message : undefined }))
    } else {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSignUp() {
    const result = signUpSchema.safeParse({ username, email, password })
    if (!result.success) {
      const newErrors: { username?: string; email?: string; password?: string } = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as 'username' | 'email' | 'password'
        newErrors[key] = issue.message
      }
      setErrors(newErrors)
      return
    }

    setLoading(true)
    setApiError('')

    try {
      if (!signUp) throw new Error('Sign up not initialized')

      // Clerk 7 Future API: create() returns { error } not { status, createdSessionId }
      const createResult = await signUp.create({
        emailAddress: email,
        password,
        username,
      })

      if (createResult.error) {
        throw createResult.error
      }

      // Post username to backend immediately (Pitfall 4 prevention)
      try {
        const token = await getToken()
        const api = createApiClient({
          baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
          getToken: async () => token,
        })
        await api('/api/v1/users', { method: 'POST', body: { username } })
      } catch {
        // Non-blocking — webhook will sync as fallback
      }

      router.replace('/(app)/welcome')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      if (message.toLowerCase().includes('username') && message.toLowerCase().includes('taken')) {
        setErrors((prev) => ({ ...prev, username: 'That username is already taken. Try another.' }))
      } else if (message.toLowerCase().includes('email') && message.toLowerCase().includes('exist')) {
        setErrors((prev) => ({ ...prev, email: 'An account with this email already exists.' }))
      } else {
        setApiError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignUp() {
    try {
      await clerk.client?.signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: 'mobile://oauth-callback',
        redirectUrlComplete: 'mobile://(app)/(tabs)',
      })
    } catch {
      setApiError('Something went wrong. Please try again.')
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.wordmark}>lunchboxd</Text>
        <Text style={styles.heading}>Create your account</Text>

        {apiError ? (
          <View accessibilityRole="alert" style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{apiError}</Text>
          </View>
        ) : null}

        {/* Username field */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Username</Text>
          <View style={[styles.inputRow, errors.username ? styles.inputError : null]}>
            <Text style={styles.prefix}>@</Text>
            <TextInput
              style={styles.inputWithPrefix}
              value={username}
              onChangeText={setUsername}
              onBlur={() => validateField('username', username)}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Username"
              placeholder="yourhandle"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          {errors.username ? (
            <Text accessibilityRole="alert" style={styles.fieldError}>{errors.username}</Text>
          ) : null}
        </View>

        {/* Email field */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, errors.email ? styles.inputError : null]}
            value={email}
            onChangeText={setEmail}
            onBlur={() => validateField('email', email)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            accessibilityLabel="Email"
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
          />
          {errors.email ? (
            <Text accessibilityRole="alert" style={styles.fieldError}>{errors.email}</Text>
          ) : null}
        </View>

        {/* Password field */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, errors.password ? styles.inputError : null]}
            value={password}
            onChangeText={setPassword}
            onBlur={() => validateField('password', password)}
            secureTextEntry
            accessibilityLabel="Password"
            placeholder="Min. 8 characters"
            placeholderTextColor={colors.textSecondary}
          />
          {errors.password ? (
            <Text accessibilityRole="alert" style={styles.fieldError}>{errors.password}</Text>
          ) : null}
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={[styles.primaryButton, loading ? styles.buttonDisabled : null]}
          onPress={handleSignUp}
          disabled={loading}
          accessibilityState={{ disabled: loading }}
          accessibilityLabel={loading ? 'Loading...' : 'Create account'}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Create account</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google OAuth */}
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={handleGoogleSignUp}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <Text style={styles.outlineButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Sign in link */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in')}
          accessibilityRole="link"
          style={styles.linkWrapper}
        >
          <Text style={styles.linkText}>
            Already have an account?{' '}
            <Text style={styles.linkTextAccent}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['2xl'],
    alignItems: 'stretch',
  },
  wordmark: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.semibold,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: '#92400E',
    fontSize: fontSizes.label,
  },
  fieldWrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSizes.label,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.body,
    color: colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  prefix: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    marginRight: 2,
  },
  inputWithPrefix: {
    flex: 1,
    height: 44,
    fontSize: fontSizes.body,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  fieldError: {
    fontSize: fontSizes.label,
    color: colors.destructive,
    marginTop: spacing.xs,
  },
  primaryButton: {
    height: 44,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: fontSizes.label,
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
  },
  outlineButton: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  outlineButtonText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  linkWrapper: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: fontSizes.label,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  linkTextAccent: {
    color: colors.accent,
  },
})
