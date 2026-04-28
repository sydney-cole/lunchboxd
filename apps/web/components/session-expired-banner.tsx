'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, X } from 'lucide-react'

export default function SessionExpiredBanner() {
  const searchParams = useSearchParams()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || searchParams.get('expired') !== 'true') {
    return null
  }

  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg px-4 py-3 mb-6 text-sm"
      style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
    >
      <AlertCircle size={16} className="shrink-0" />
      <span className="flex-1 font-[family-name:--font-inter]">
        Your session expired. Please sign in again.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  )
}
