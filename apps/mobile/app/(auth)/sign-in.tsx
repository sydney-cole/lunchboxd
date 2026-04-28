import { useSignIn, useClerk } from '@clerk/expo'
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
import { signInSchema } from '@lunchboxd/shared'

export default function SignInScreen() {
  const { signIn } = useSignIn()
  const clerk = useClerk()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  function validateField(field: 'email' | 'password', value: string) {
    const partial = field === 'email'
      ? { email: value, password: password || 'placeholder123' }
      : { email: email || 'placeholder@x.com', password: value }

    const result = signInSchema.safeParse(partial)
    if (!result.success) {
      const fieldError = result.error.issues.find((i) => i.path[0] === field)
      setErrors((prev) => ({ ...prev, [field]: fieldError ? fieldError.message : undefined }))
    } else {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSignIn() {
    const result = signInSchema.safeParse({ email, password })
    if (!result.success) {
      const newErrors: { email?: string; password?: string } = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as 'email' | 'password'
        newErrors[key] = issue.message
      }
      setErrors(newErrors)
      return
    }

    setLoading(true)
    setApiError('')

    try {
      if (!signIn) throw new Error('Sign in not initialized')

      // Clerk 7 Future API: create → password → finalize
      await signIn.create({ identifier: email })
      await (signIn as unknown as { password: (opts: { password: string }) => Promise<void> }).password({ password })
      const finalResult = await (signIn as unknown as { finalize: () => Promise<{ status: string }> }).finalize()

      if ((finalResult as { status?: string }).status === 'complete') {
        router.replace('/(app)/(tabs)')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (
        message.toLowerCase().includes('invalid') ||
        message.toLowerCase().includes('password') ||
        message.toLowerCase().includes('identifier') ||
        message.toLowerCase().includes('credentials')
      ) {
        setApiError('Email or password is incorrect.')
      } else {
        setApiError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    try {
      await clerk.client?.signIn.authenticateWithRedirect({
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
        <Text style={styles.heading}>Welcome back</Text>

        {apiError ? (
          <View accessibilityRole="alert" style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{apiError}</Text>
          </View>
        ) : null}

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
            autoFocus
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
            placeholder="Your password"
            placeholderTextColor={colors.textSecondary}
          />
          {errors.password ? (
            <Text accessibilityRole="alert" style={styles.fieldError}>{errors.password}</Text>
          ) : null}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            accessibilityRole="link"
            style={styles.forgotLinkWrapper}
          >
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={[styles.primaryButton, loading ? styles.buttonDisabled : null]}
          onPress={handleSignIn}
          disabled={loading}
          accessibilityState={{ disabled: loading }}
          accessibilityLabel={loading ? 'Loading...' : 'Sign in'}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Sign in</Text>
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
          onPress={handleGoogleSignIn}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <Text style={styles.outlineButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Create account link */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-up')}
          accessibilityRole="link"
          style={styles.linkWrapper}
        >
          <Text style={styles.linkText}>
            Don't have an account?{' '}
            <Text style={styles.linkTextAccent}>Create account</Text>
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
  inputError: {
    borderColor: colors.destructive,
  },
  fieldError: {
    fontSize: fontSizes.label,
    color: colors.destructive,
    marginTop: spacing.xs,
  },
  forgotLinkWrapper: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  forgotLink: {
    fontSize: fontSizes.label,
    color: colors.textSecondary,
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
