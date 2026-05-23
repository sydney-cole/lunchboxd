'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'

interface PhotoPickerProps {
  photoUrl: string | null
  onPhotoChange: (url: string | null) => void
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export function PhotoPicker({ photoUrl, onPhotoChange }: PhotoPickerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(photoUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // ME-05: Use a ref to track blob object URLs for cleanup — avoids closure over stale state value.
  // Initialized to null (not photoUrl) because CDN URLs must not be passed to revokeObjectURL.
  const previewUrlRef = useRef<string | null>(null)
  const errorId = 'photo-picker-error'

  // Revoke object URL only on unmount — avoids premature revocation when state changes
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, []) // empty deps — runs only on unmount

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset error state
    setError(null)

    // Client-side file size validation — 10MB limit
    if (file.size > MAX_SIZE_BYTES) {
      setError('Photo must be under 10MB.')
      e.target.value = ''
      return
    }

    // Create preview immediately — track via ref for stable cleanup reference
    const objectUrl = URL.createObjectURL(file)
    previewUrlRef.current = objectUrl
    setPreviewUrl(objectUrl)
    setIsUploading(true)

    try {
      const body = new FormData()
      body.append('file', file)
      body.append('type', 'review')

      const uploadRes = await fetch('/api/v1/uploads', { method: 'POST', body })

      if (!uploadRes.ok) throw new Error('Upload failed')

      const { url } = await uploadRes.json()
      onPhotoChange(url)
    } catch {
      setError('Photo upload failed. Try again.')
      setPreviewUrl(null)
      onPhotoChange(null)
    } finally {
      setIsUploading(false)
      // Reset input so same file can be re-selected after error
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewUrl(null)
    setError(null)
    onPhotoChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const hasPhoto = photoUrl && previewUrl

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Add a photo"
        aria-describedby={error ? errorId : undefined}
        onChange={handleFileSelect}
      />

      {hasPhoto || previewUrl ? (
        /* Thumbnail preview */
        <div className="relative inline-block">
          <div
            className="relative w-[80px] h-[80px] rounded-[8px] overflow-hidden border border-border"
            style={{ minWidth: 80 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl!}
              alt="Photo preview"
              className="w-full h-full object-cover"
            />
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 size={20} className="text-white animate-spin" />
              </div>
            )}
          </div>
          {!isUploading && (
            <button
              type="button"
              aria-label="Remove photo"
              className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-destructive transition-colors shadow-sm focus:outline-none"
              onClick={handleRemove}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ) : (
        /* Default state: dashed add photo button */
        <button
          type="button"
          aria-label="Add a photo"
          aria-describedby={error ? errorId : undefined}
          className={`w-full h-[80px] flex flex-col items-center justify-center gap-1 bg-surface border-2 border-dashed rounded-[8px] transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 hover:border-accent ${
            error ? 'border-destructive' : 'border-border'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera size={24} className="text-text-secondary" />
          <span className="text-[16px] text-text-secondary">Add photo</span>
        </button>
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-1 text-[14px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
