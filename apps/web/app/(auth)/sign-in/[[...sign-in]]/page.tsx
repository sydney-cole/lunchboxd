'use client'

import { useState, useRef, Suspense } from 'react'
import { useSignIn, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Loader2 } from 'lucide-react'
import AuthCard from '@/components/auth-card'
import GoogleLogo from '@/components/google-logo'
import SessionExpiredBanner from '@/components/session-expired-banner'

interface FieldErrors {
  email?: string
  password?: string
  general?: string
}

function SignInForm() {
  const { signIn } = useSignIn()
  const clerk = useClerk()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  function validateEmail(value: string): string | undefined {
    if (!value) return 'This field is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.'
  }

  function validatePassword(value: string): string | undefined {
    if (!value) return 'This field is required.'
  }

  function handleEmailBlur() {
    setErrors(prev => ({ ...prev, email: validateEmail(email) }))
  }

  function handlePasswordBlur() {
    setErrors(prev => ({ ...prev, password: validatePassword(password) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)

    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError })
      if (emailError) emailRef.current?.focus()
      else if (passwordError) passwordRef.current?.focus()
      return
    }

    if (!signIn) return

    setIsLoading(true)
    setErrors({})

    try {
      // Clerk 7 Future API: step 1 — create with identifier
      const { error: createError } = await signIn.create({ identifier: email })

      if (createError) {
        setErrors({ general: 'Email or password is incorrect.' })
        return
      }

      // Step 2 — submit password
      const { error: passwordError2 } = await signIn.password({ password })

      if (passwordError2) {
        setErrors({ general: 'Email or password is incorrect.' })
        passwordRef.current?.focus()
        return
      }

      // Step 3 — finalize (sets active session)
      const { error: finalizeError } = await signIn.finalize()

      if (finalizeError) {
        setErrors({ general: (finalizeError as { message?: string }).message ?? 'Something went wrong. Please try again.' })
        return
      }

      router.push('/')
    } catch {
      setErrors({ general: 'Something went wrong. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    if (!clerk.client) return
    await clerk.client.signIn.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/',
    })
  }

  return (
    <AuthCard heading="Welcome back">
      <SessionExpiredBanner />

      <form onSubmit={handleSubmit} noValidate>
        {errors.general && (
          <div role="alert" className="flex items-center gap-2 mb-4 text-destructive text-[14px] font-[family-name:--font-inter]">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        {/* Email field */}
        <div className="mb-6">
          <label
            htmlFor="email"
            className="block text-[14px] font-[family-name:--font-inter] text-text-primary mb-2"
          >
            Email
          </label>
          <div className="relative">
            <input
              ref={emailRef}
              id="email"
              type="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              aria-describedby={errors.email ? 'email-error' : undefined}
              aria-invalid={!!errors.email}
              placeholder="you@example.com"
              className={`w-full h-[44px] px-3 pr-10 bg-surface border rounded-lg text-[16px] font-[family-name:--font-inter] text-text-primary placeholder:text-text-secondary outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0 transition-colors ${
                errors.email ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.email && (
              <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive" aria-hidden="true" />
            )}
          </div>
          {errors.email && (
            <p id="email-error" role="alert" className="mt-1 text-[14px] font-[family-name:--font-inter] text-destructive">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password field */}
        <div className="mb-2">
          <label
            htmlFor="password"
            className="block text-[14px] font-[family-name:--font-inter] text-text-primary mb-2"
          >
            Password
          </label>
          <div className="relative">
            <input
              ref={passwordRef}
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onBlur={handlePasswordBlur}
              aria-describedby={errors.password ? 'password-error' : undefined}
              aria-invalid={!!errors.password}
              placeholder="Your password"
              className={`w-full h-[44px] px-3 pr-10 bg-surface border rounded-lg text-[16px] font-[family-name:--font-inter] text-text-primary placeholder:text-text-secondary outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0 transition-colors ${
                errors.password ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.password && (
              <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive" aria-hidden="true" />
            )}
          </div>
          {errors.password && (
            <p id="password-error" role="alert" className="mt-1 text-[14px] font-[family-name:--font-inter] text-destructive">
              {errors.password}
            </p>
          )}
        </div>

        {/* Forgot password link */}
        <div className="mb-8 text-right">
          <Link
            href="/forgot-password"
            className="text-[14px] font-[family-name:--font-inter] text-text-secondary hover:underline hover:text-accent transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Primary CTA */}
        <button
          type="submit"
          disabled={isLoading}
          aria-disabled={isLoading}
          aria-label={isLoading ? 'Loading...' : undefined}
          className="w-full h-[44px] bg-accent hover:bg-accent-hover active:bg-accent-active disabled:opacity-50 disabled:cursor-not-allowed text-white text-[16px] font-semibold font-[family-name:--font-inter] rounded-lg transition-colors flex items-center justify-center mb-4"
        >
          {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Sign in'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-4">
          <hr className="flex-1 border-border" />
          <span className="text-[14px] font-[family-name:--font-inter] text-text-secondary">or</span>
          <hr className="flex-1 border-border" />
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full h-[44px] border border-border hover:border-accent bg-transparent text-text-primary text-[16px] font-semibold font-[family-name:--font-inter] rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <GoogleLogo />
          Continue with Google
        </button>
      </form>

      {/* Sign-up link */}
      <p className="mt-6 text-center text-[14px] font-[family-name:--font-inter] text-text-secondary">
        Don&apos;t have an account?{' '}
        <Link href="/sign-up" className="hover:underline hover:text-accent transition-colors">
          Create account
        </Link>
      </p>
    </AuthCard>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  )
}
