'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { formatRelativeTime } from '@/lib/utils'

interface NotificationItem {
  id: string
  type: 'follow' | 'like'
  read: boolean
  createdAt: string
  actor: { username: string; avatarUrl: string | null } | null
  reviewId: string | null
  restaurantName: string | null
}

interface NotificationsResponse {
  items: NotificationItem[]
  nextCursor: string | null
}

function NotificationRow({ item, isLast }: { item: NotificationItem; isLast: boolean }) {
  const actionText =
    item.type === 'follow'
      ? 'followed you'
      : `liked your review of ${item.restaurantName ?? 'your homemade meal'}`

  return (
    <li
      role="article"
      className={`flex items-center gap-2 px-4 py-3 ${item.read ? '' : 'border-l-2 border-accent'} ${isLast ? '' : 'border-b border-border'}`}
    >
      {item.actor?.avatarUrl ? (
        <img
          src={item.actor.avatarUrl}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          alt=""
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] text-accent font-medium">
            {item.actor?.username.charAt(0).toUpperCase() ?? '?'}
          </span>
        </div>
      )}
      <span className="text-[13px] text-text-secondary flex-1 min-w-0">
        <span className="font-semibold text-text-primary">@{item.actor?.username ?? 'unknown'}</span>
        {' '}{actionText}
        {' · '}{formatRelativeTime(item.createdAt)}
      </span>
    </li>
  )
}

export function NotificationBell() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLLIElement>(null)

  // Unread badge query — polls every 30s
  const { data: unreadData } = useQuery<{ hasUnread: boolean }>({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const res = await fetch('/api/v1/notifications/unread')
      if (!res.ok) throw new Error('Failed to check unread status')
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const hasUnread = unreadData?.hasUnread ?? false

  // Panel notification list — only fetched when panel is open
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam }) => {
      const url = pageParam
        ? `/api/v1/notifications?cursor=${encodeURIComponent(pageParam as string)}`
        : '/api/v1/notifications'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load notifications')
      return res.json() as Promise<NotificationsResponse>
    },
    enabled: isOpen,
    staleTime: 30_000,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  const allItems = data?.pages.flatMap((page) => page.items) ?? []

  const handleOpen = useCallback(async () => {
    setIsOpen(true)
    // Fire read-all and invalidate unread badge
    try {
      await fetch('/api/v1/notifications/read-all', { method: 'PATCH' })
    } catch {
      // non-critical — badge will clear on next poll
    }
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    // HI-08: Also invalidate the notifications list so panel items reflect updated read state immediately
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }, [queryClient])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Click-outside handler
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleMouseDown)
    }
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, handleClose])

  // IntersectionObserver sentinel — triggers fetchNextPage
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )
    const el = sentinelRef.current
    if (el) observer.observe(el)
    return () => {
      if (el) observer.unobserve(el)
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={isOpen ? handleClose : handleOpen}
        className="relative p-2.5 rounded-full hover:bg-bg transition-colors"
        aria-label={hasUnread ? 'Notifications — new activity' : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell size={20} className="text-text-secondary hover:text-text-primary" />
        {hasUnread && (
          <span
            className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500"
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] overflow-y-auto bg-surface border border-border rounded-[12px] shadow-[0_4px_12px_rgba(28,25,23,0.12)] z-50"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <h2 className="text-[16px] font-semibold text-text-primary">Notifications</h2>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 size={16} className="animate-spin text-text-secondary" />
            </div>
          )}

          {/* Error state */}
          {isError && (
            <p className="text-[14px] text-destructive px-4 py-4">
              Could not load notifications. Pull down to retry.
            </p>
          )}

          {/* Notification list */}
          {!isLoading && !isError && (
            <ul>
              {allItems.length === 0 && (
                <li className="px-4 py-8 text-center">
                  <p className="text-[16px] font-semibold text-text-primary mb-1">No notifications yet</p>
                  <p className="text-[14px] text-text-secondary">
                    When someone follows you or likes a review, you&apos;ll see it here.
                  </p>
                </li>
              )}
              {allItems.map((item, idx) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  isLast={idx === allItems.length - 1}
                />
              ))}
              {/* Sentinel for infinite scroll */}
              <li ref={sentinelRef} />
            </ul>
          )}

          {isFetchingNextPage && (
            <div className="flex justify-center py-3">
              <Loader2 size={14} className="animate-spin text-text-secondary" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
