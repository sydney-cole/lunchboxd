'use client'

import { useState, useRef } from 'react'
import { useSignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react'
import AuthCard from '@/components/auth-card'

export default function ForgotPasswordPage() {
  const { signIn } = useSignIn()

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [generalError, setGeneralError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)

  function validateEmail(value: string): string | undefined {
    if (!value) return 'This field is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.'
  }

  function handleEmailBlur() {
    setEmailError(validateEmail(email))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const error = validateEmail(email)
    if (error) {
      setEmailError(error)
      emailRef.current?.focus()
      return
    }

    if (!signIn) return

    setIsLoading(true)
    setEmailError(undefined)
    setGeneralError(undefined)

    try {
      // Clerk 7 Future API: first create with identifier, then send reset code
      const { error: createError } = await signIn.create({ identifier: email })

      if (createError) {
        setGeneralError('Something went wrong. Please try again.')
        return
      }

      // Send the password reset code via email
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode()

      if (sendError) {
        setGeneralError((sendError as { message?: string }).message ?? 'Something went wrong. Please try again.')
        return
      }

      setSubmitted(true)
    } catch {
      setGeneralError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (submitted) {
    return (
      <AuthCard heading="Reset your password">
        <div className="flex flex-col items-center text-center py-4">
          <CheckCircle size={40} className="text-accent mb-4" />
          <p className="text-[16px] font-[family-name:--font-inter] text-text-primary">
            Check your email — we sent a reset link to{' '}
            <span className="font-semibold">{email}</span>.
          </p>
          <Link
            href="/sign-in"
            className="mt-6 text-[14px] font-[family-name:--font-inter] text-text-secondary hover:underline hover:text-accent transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard heading="Reset your password">
      <form onSubmit={handleSubmit} noValidate>
        {generalError && (
          <div role="alert" className="flex items-center gap-2 mb-4 text-destructive text-[14px] font-[family-name:--font-inter]">
            <AlertCircle size={16} className="shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Email field */}
        <div className="mb-8">
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
              aria-describedby={emailError ? 'email-error' : undefined}
              aria-invalid={!!emailError}
              placeholder="you@example.com"
              className={`w-full h-[44px] px-3 pr-10 bg-surface border rounded-lg text-[16px] font-[family-name:--font-inter] text-text-primary placeholder:text-text-secondary outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0 transition-colors ${
                emailError ? 'border-destructive' : 'border-border'
              }`}
            />
            {emailError && (
              <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive" aria-hidden="true" />
            )}
          </div>
          {emailError && (
            <p id="email-error" role="alert" className="mt-1 text-[14px] font-[family-name:--font-inter] text-destructive">
              {emailError}
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
          {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Send reset link'}
        </button>
      </form>

      {/* Back to sign in */}
      <p className="mt-4 text-center text-[14px] font-[family-name:--font-inter] text-text-secondary">
        <Link
          href="/sign-in"
          className="hover:underline hover:text-accent transition-colors"
        >
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  )
}
