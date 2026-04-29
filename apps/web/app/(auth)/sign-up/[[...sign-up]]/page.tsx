'use client'

import { useState, useRef } from 'react'
import { useSignUp, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Loader2 } from 'lucide-react'
import AuthCard from '@/components/auth-card'
import GoogleLogo from '@/components/google-logo'

interface FieldErrors {
  username?: string
  email?: string
  password?: string
  general?: string
}

export default function SignUpPage() {
  const { signUp } = useSignUp()
  const clerk = useClerk()
  const { setActive } = clerk
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  const usernameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  function validateUsername(value: string): string | undefined {
    if (!value) return 'This field is required.'
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscores.'
    if (value.length > 30) return 'Username can only contain letters, numbers, and underscores.'
  }

  function validateEmail(value: string): string | undefined {
    if (!value) return 'This field is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.'
  }

  function validatePassword(value: string): string | undefined {
    if (!value) return 'This field is required.'
    if (value.length < 8) return 'Password must be at least 8 characters.'
  }

  function handleUsernameBlur() {
    setErrors(prev => ({ ...prev, username: validateUsername(username) }))
  }

  function handleEmailBlur() {
    setErrors(prev => ({ ...prev, email: validateEmail(email) }))
  }

  function handlePasswordBlur() {
    setErrors(prev => ({ ...prev, password: validatePassword(password) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const usernameError = validateUsername(username)
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)

    if (usernameError || emailError || passwordError) {
      setErrors({ username: usernameError, email: emailError, password: passwordError })
      if (usernameError) usernameRef.current?.focus()
      else if (emailError) emailRef.current?.focus()
      else if (passwordError) passwordRef.current?.focus()
      return
    }

    if (!signUp) return

    setIsLoading(true)
    setErrors({})

    try {
      // Clerk 7 Future API: create returns { error }
      const { error: createError } = await signUp.create({
        emailAddress: email,
        password,
        username,
      })

      if (createError) {
        const code = (createError as { code?: string }).code ?? ''
        if (code === 'form_identifier_exists' || code === 'form_username_taken') {
          setErrors({ username: 'That username is already taken. Try another.' })
          usernameRef.current?.focus()
        } else if (code.includes('password')) {
          setErrors({ password: 'Password must be at least 8 characters.' })
          passwordRef.current?.focus()
        } else {
          setErrors({ general: (createError as { message?: string }).message ?? 'Something went wrong. Please try again.' })
        }
        return
      }

      // Finalize sets the session as active
      const finalizeResult = await signUp.finalize()

      if (finalizeResult.error) {
        setErrors({ general: (finalizeResult.error as { message?: string }).message ?? 'Something went wrong. Please try again.' })
        return
      }

      // Explicitly activate the session so the auth cookie is set before the API call
      if ('session' in finalizeResult && finalizeResult.session) {
        await setActive({ session: finalizeResult.session as Parameters<typeof setActive>[0]['session'] })
      }

      // Store username immediately after session is active (Pitfall 4 from RESEARCH.md)
      const userRes = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })

      if (!userRes.ok) {
        setErrors({ general: 'Account created but profile setup failed. Please try signing in.' })
        return
      }

      router.push('/welcome')
    } catch {
      setErrors({ general: 'Something went wrong. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleSignUp() {
    if (!clerk.client) return
    await clerk.client.signUp.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/welcome',
    })
  }

  return (
    <AuthCard heading="Create your account">
      <form onSubmit={handleSubmit} noValidate>
        {errors.general && (
          <div role="alert" className="flex items-center gap-2 mb-4 text-destructive text-[14px] font-[family-name:--font-inter]">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        {/* Username field */}
        <div className="mb-6">
          <label
            htmlFor="username"
            className="block text-[14px] font-[family-name:--font-inter] text-text-primary mb-2"
          >
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-[family-name:--font-inter] text-[16px] select-none pointer-events-none">
              @
            </span>
            <input
              ref={usernameRef}
              id="username"
              type="text"
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              onBlur={handleUsernameBlur}
              aria-describedby={errors.username ? 'username-error' : undefined}
              aria-invalid={!!errors.username}
              placeholder="yourhandle"
              className={`w-full h-[44px] pl-8 pr-10 bg-surface border rounded-lg text-[16px] font-[family-name:--font-inter] text-text-primary placeholder:text-text-secondary outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0 transition-colors ${
                errors.username ? 'border-destructive' : 'border-border'
              }`}
            />
            {errors.username && (
              <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive" aria-hidden="true" />
            )}
          </div>
          {errors.username && (
            <p id="username-error" role="alert" className="mt-1 text-[14px] font-[family-name:--font-inter] text-destructive">
              {errors.username}
            </p>
          )}
        </div>

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
        <div className="mb-8">
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
              placeholder="Min. 8 characters"
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

        {/* Primary CTA */}
        <button
          type="submit"
          disabled={isLoading}
          aria-disabled={isLoading}
          aria-label={isLoading ? 'Loading...' : undefined}
          className="w-full h-[44px] bg-accent hover:bg-accent-hover active:bg-accent-active disabled:opacity-50 disabled:cursor-not-allowed text-white text-[16px] font-semibold font-[family-name:--font-inter] rounded-lg transition-colors flex items-center justify-center mb-4"
        >
          {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Create account'}
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
          onClick={handleGoogleSignUp}
          className="w-full h-[44px] border border-border hover:border-accent bg-transparent text-text-primary text-[16px] font-semibold font-[family-name:--font-inter] rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <GoogleLogo />
          Continue with Google
        </button>
      </form>

      {/* Sign-in link */}
      <p className="mt-6 text-center text-[14px] font-[family-name:--font-inter] text-text-secondary">
        Already have an account?{' '}
        <Link href="/sign-in" className="hover:underline hover:text-accent transition-colors">
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}
