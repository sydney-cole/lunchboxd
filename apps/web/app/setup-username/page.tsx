'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import AuthCard from '@/components/auth-card'

export default function SetupUsernamePage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function validate(value: string): string | undefined {
    if (!value) return 'This field is required.'
    if (value.length < 2) return 'Username must be at least 2 characters.'
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscores.'
    if (value.length > 30) return 'Username must be 30 characters or fewer.'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate(username)
    if (validationError) {
      setError(validationError)
      inputRef.current?.focus()
      return
    }

    setIsLoading(true)
    setError(undefined)

    try {
      const res = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 400 && data.error === 'Invalid username') {
          setError('That username is invalid. Letters, numbers, and underscores only.')
        } else if (res.status === 409) {
          setError('That username is already taken. Try another.')
        } else {
          setError('Something went wrong. Please try again.')
        }
        return
      }

      router.replace('/welcome')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-bg min-h-screen">
      <AuthCard heading="Choose a username">
        <p className="text-[14px] font-[family-name:--font-inter] text-text-secondary mb-6">
          Pick a handle for your Lunchboxd profile.
        </p>

        <form onSubmit={handleSubmit} noValidate>
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
                ref={inputRef}
                id="username"
                type="text"
                autoFocus
                value={username}
                onChange={e => setUsername(e.target.value)}
                onBlur={() => setError(validate(username))}
                aria-describedby={error ? 'username-error' : undefined}
                aria-invalid={!!error}
                placeholder="yourhandle"
                minLength={2}
                maxLength={30}
                className={`w-full h-[44px] pl-8 pr-10 bg-surface border rounded-lg text-[16px] font-[family-name:--font-inter] text-text-primary placeholder:text-text-secondary outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0 transition-colors ${
                  error ? 'border-destructive' : 'border-border'
                }`}
              />
              {error && (
                <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive" aria-hidden="true" />
              )}
            </div>
            {error && (
              <p id="username-error" role="alert" className="mt-1 text-[14px] font-[family-name:--font-inter] text-destructive">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            aria-disabled={isLoading}
            className="w-full h-[44px] bg-accent hover:bg-accent-hover active:bg-accent-active disabled:opacity-50 disabled:cursor-not-allowed text-white text-[16px] font-semibold font-[family-name:--font-inter] rounded-lg transition-colors flex items-center justify-center"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Continue'}
          </button>
        </form>
      </AuthCard>
    </div>
  )
}
