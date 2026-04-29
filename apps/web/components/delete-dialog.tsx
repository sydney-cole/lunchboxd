'use client'

import React, { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface DeleteDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

export function DeleteDialog({ open, onClose, onConfirm, loading = false }: DeleteDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Trap focus within dialog when open
  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus()
    }
  }, [open])

  // Close on Escape key
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
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose()
        }
      }}
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-[400px] bg-surface border border-border rounded-[12px] shadow-[0_4px_24px_rgba(28,25,23,0.16)] p-6"
      >
        <h2
          id="delete-dialog-title"
          className="text-[20px] font-semibold text-text-primary mb-2"
        >
          Delete this review?
        </h2>
        <p className="text-[16px] text-text-secondary mb-6">
          This can&apos;t be undone.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          {/* Delete / Confirm button */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center justify-center gap-2 h-[44px] w-full sm:flex-1 bg-destructive text-white text-[16px] font-semibold rounded-[8px] transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete</span>
            )}
          </button>

          {/* Cancel button */}
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex items-center justify-center h-[44px] w-full sm:flex-1 bg-transparent border border-border text-text-primary text-[16px] font-semibold rounded-[8px] transition-colors hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            Keep Review
          </button>
        </div>
      </div>
    </div>
  )
}
