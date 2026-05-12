'use client'

import React, { useEffect, useRef } from 'react'
import { Loader2, Trash2 } from 'lucide-react'

interface DeleteDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

export function DeleteDialog({ open, onClose, onConfirm, loading = false }: DeleteDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, loading, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-[400px] bg-surface border border-border rounded-2xl shadow-[0_16px_48px_rgba(28,25,23,0.16),0_4px_16px_rgba(28,25,23,0.08)] p-6"
      >
        {/* Icon */}
        <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <Trash2 size={20} className="text-destructive" />
        </div>

        <h2
          id="delete-dialog-title"
          className="font-[family-name:--font-fraunces] text-[22px] font-semibold text-text-primary mb-1.5"
        >
          Delete this review?
        </h2>
        <p className="text-[15px] text-text-secondary mb-6 leading-relaxed">
          This action can&apos;t be undone.
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center justify-center gap-2 h-11 w-full sm:flex-1 bg-destructive text-white text-[15px] font-semibold rounded-xl transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>

          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex items-center justify-center h-11 w-full sm:flex-1 bg-surface-subtle border border-border text-text-primary text-[15px] font-semibold rounded-xl transition-all duration-150 hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            Keep Review
          </button>
        </div>
      </div>
    </div>
  )
}
