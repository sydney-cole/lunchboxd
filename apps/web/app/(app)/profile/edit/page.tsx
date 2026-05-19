'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Camera } from 'lucide-react'

interface MeUser {
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
}

export default function EditProfilePage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [meUser, setMeUser] = useState<MeUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [bio, setBio] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const originalBio = useRef('')
  const originalDisplayName = useRef('')

  useEffect(() => {
    fetch('/api/v1/users/me')
      .then(r => r.json())
      .then((data: { user?: MeUser }) => {
        if (!data.user) { router.push('/sign-in'); return }
        setMeUser(data.user)
        const dn = data.user.displayName ?? ''
        const b = data.user.bio ?? ''
        setDisplayName(dn)
        originalDisplayName.current = dn
        setBio(b)
        originalBio.current = b
        if (data.user.avatarUrl) setAvatarPreview(data.user.avatarUrl)
      })
      .catch(() => router.push('/sign-in'))
      .finally(() => setIsLoading(false))
  }, [router])

  if (isLoading || !meUser) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-text-secondary" />
      </div>
    )
  }

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setAvatarError('Please select a JPEG, PNG, or WebP image.')
      return
    }

    setAvatarError(null)
    setAvatarPreview(URL.createObjectURL(file))
    setIsUploadingAvatar(true)

    try {
      const body = new FormData()
      body.append('file', file)
      body.append('type', 'avatar')

      const uploadRes = await fetch('/api/v1/uploads', { method: 'POST', body })
      if (!uploadRes.ok) throw new Error('Upload failed')

      const { url } = await uploadRes.json() as { url: string }
      setAvatarUrl(url)
    } catch {
      setAvatarError('Photo upload failed. Try a different image.')
      setAvatarPreview(null)
      setAvatarUrl(null)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  async function handleSave() {
    if (!meUser) return
    setSaveError(null)
    setIsSaving(true)

    try {
      const body: Record<string, string | undefined> = {}
      // Only send fields that were actually modified
      if (bio !== originalBio.current) body.bio = bio
      if (displayName !== originalDisplayName.current) body.displayName = displayName
      if (avatarUrl) body.avatarUrl = avatarUrl

      if (Object.keys(body).length === 0) {
        router.push(`/@${meUser.username}`)
        return
      }

      const res = await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        setSaveError('Failed to save changes. Please try again.')
        return
      }

      queryClient.invalidateQueries({ queryKey: ['profile', meUser.username] })
      router.push(`/@${meUser.username}`)
    } catch {
      setSaveError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg py-6 px-4">
      <div className="w-full max-w-[480px] mx-auto">
        {/* Back link */}
        <a
          href={`/@${meUser.username}`}
          className="text-[14px] text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent rounded mb-6 inline-block"
        >
          ← Back to profile
        </a>

        <h1 className="text-[20px] font-semibold text-text-primary mb-6">Edit Profile</h1>

        {/* Avatar upload */}
        <div className="flex flex-col items-center mb-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative w-20 h-20 rounded-full overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Upload profile photo"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-accent/20 flex items-center justify-center">
                <span className="text-[28px] font-medium text-accent" aria-hidden="true">
                  {meUser.username[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            {/* Upload overlay on hover */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isUploadingAvatar
                ? <Loader2 size={20} className="animate-spin text-white" />
                : <Camera size={20} className="text-white" />
              }
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleAvatarSelect}
            aria-label="Upload photo"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-[14px] text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent rounded"
          >
            Upload photo
          </button>
          {avatarError && (
            <p className="mt-1 text-[14px] text-destructive">{avatarError}</p>
          )}
        </div>

        {/* Display name */}
        <div className="mb-4">
          <label htmlFor="displayName" className="block text-[14px] font-medium text-text-primary mb-1">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            maxLength={50}
            className="w-full px-3 py-2 text-[16px] border border-border rounded-md bg-white text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Bio */}
        <div className="mb-6">
          <label htmlFor="bio" className="block text-[14px] font-medium text-text-primary mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Write a short bio..."
            maxLength={500}
            rows={4}
            className="w-full px-3 py-2 text-[16px] border border-border rounded-md bg-white text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            aria-describedby={bio.length > 450 ? 'bio-char-count' : undefined}
          />
          {bio.length > 450 && (
            <p id="bio-char-count" className="text-[13px] text-text-secondary mt-1">
              {500 - bio.length} characters remaining
            </p>
          )}
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isUploadingAvatar}
          className="w-full py-2.5 rounded-md bg-accent text-white text-[16px] font-medium hover:bg-accent-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Saving...
            </span>
          ) : (
            'Save changes'
          )}
        </button>

        {saveError && (
          <p className="mt-2 text-[14px] text-destructive text-center">{saveError}</p>
        )}
      </div>
    </div>
  )
}
