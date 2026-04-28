import { useSignIn } from '@clerk/expo'
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
} from 'react-native'
import { colors, fontSizes, fontWeights, spacing, radii } from '@lunchboxd/shared'
import { forgotPasswordSchema } from '@lunchboxd/shared'

export default function ForgotPasswordScreen() {
  const { signIn } = useSignIn()

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successEmail, setSuccessEmail] = useState('')

  function validateEmail(value: string) {
    const result = forgotPasswordSchema.safeParse({ email: value })
    if (!result.success) {
      const err = result.error.issues[0]
      setEmailError(err ? err.message : '')
    } else {
      setEmailError('')
    }
  }

  async function handleSendResetLink() {
    const result = forgotPasswordSchema.safeParse({ email })
    if (!result.success) {
      setEmailError(result.error.issues[0]?.message || 'Enter a valid email address.')
      return
    }

    setLoading(true)
    setApiError('')

    try {
      if (!signIn) throw new Error('Sign in not initialized')

      // Use identifier-first flow then request reset via resetPasswordEmailCode
      await (signIn as unknown as { resetPasswordEmailCode: (opts: { email: string }) => Promise<void> }).resetPasswordEmailCode({ email })

      setSuccessEmail(email)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('no user')) {
        // Don't reveal if email exists — show same success message
        setSuccessEmail(email)
      } else {
        setApiError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (successEmail) {
    return (
      <View style={styles.container}>
        <Text style={styles.wordmark}>lunchboxd</Text>
        <Text style={styles.heading}>Reset your password</Text>
        <View style={styles.successBox}>
          <Text style={styles.successText}>
            Check your email — we sent a reset link to {successEmail}.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in')}
          accessibilityRole="link"
          style={styles.linkWrapper}
        >
          <Text style={styles.linkText}>
            <Text style={styles.linkTextAccent}>Back to sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.wordmark}>lunchboxd</Text>
        <Text style={styles.heading}>Reset your password</Text>

        {apiError ? (
          <View accessibilityRole="alert" style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{apiError}</Text>
          </View>
        ) : null}

        {/* Email field */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, emailError ? styles.inputError : null]}
            value={email}
            onChangeText={setEmail}
            onBlur={() => validateEmail(email)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoFocus
            accessibilityLabel="Email"
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
          />
          {emailError ? (
            <Text accessibilityRole="alert" style={styles.fieldError}>{emailError}</Text>
          ) : null}
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={[styles.primaryButton, loading ? styles.buttonDisabled : null]}
          onPress={handleSendResetLink}
          disabled={loading}
          accessibilityState={{ disabled: loading }}
          accessibilityLabel={loading ? 'Loading...' : 'Send reset link'}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Send reset link</Text>
          )}
        </TouchableOpacity>

        {/* Back to sign in */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in')}
          accessibilityRole="link"
          style={styles.linkWrapper}
        >
          <Text style={styles.linkText}>
            <Text style={styles.linkTextAccent}>Back to sign in</Text>
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
  successBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successText: {
    fontSize: fontSizes.body,
    color: colors.textPrimary,
    lineHeight: 24,
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
    marginBottom: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.white,
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
