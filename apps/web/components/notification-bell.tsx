'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
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
      className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
        item.read ? 'hover:bg-surface-subtle' : 'bg-accent-subtle hover:bg-accent-subtle/70 border-l-2 border-accent'
      } ${isLast ? '' : 'border-b border-border'}`}
    >
      {item.actor ? (
        <Link href={`/@${item.actor.username}`} className="flex-shrink-0">
          {item.actor.avatarUrl ? (
            <img
              src={item.actor.avatarUrl}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-white"
              alt=""
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center">
              <span className="text-[12px] text-accent font-bold">
                {item.actor.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </Link>
      ) : (
        <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
          <span className="text-[12px] text-accent font-bold">?</span>
        </div>
      )}
      <span className="text-[13px] text-text-secondary flex-1 min-w-0 leading-snug">
        {item.actor ? (
          <Link href={`/@${item.actor.username}`} className="font-semibold text-text-primary hover:underline">
            @{item.actor.username}
          </Link>
        ) : (
          <span className="font-semibold text-text-primary">unknown</span>
        )}
        {' '}{actionText}
        <span className="text-text-tertiary ml-1">· {formatRelativeTime(item.createdAt)}</span>
      </span>
    </li>
  )
}

export function NotificationBell() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLLIElement>(null)

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
    try {
      await fetch('/api/v1/notifications/read-all', { method: 'PATCH' })
    } catch {
      // non-critical
    }
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }, [queryClient])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

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
        className="relative p-2 rounded-full hover:bg-accent-subtle transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label={hasUnread ? 'Notifications — new activity' : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell
          size={20}
          className={`transition-colors duration-150 ${isOpen ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
        />
        {hasUnread && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive ring-2 ring-white"
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2.5 w-[380px] max-h-[480px] overflow-y-auto bg-surface border border-border rounded-2xl shadow-[0_16px_48px_rgba(28,25,23,0.14),0_4px_16px_rgba(28,25,23,0.08)] z-50"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="px-5 pt-4 pb-3.5 border-b border-border">
            <h2 className="font-[family-name:--font-fraunces] text-[18px] font-semibold text-text-primary">
              Notifications
            </h2>
          </div>

          {isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 size={18} className="animate-spin text-text-tertiary" />
            </div>
          )}

          {isError && (
            <p className="text-[14px] text-destructive px-5 py-5">
              Could not load notifications.
            </p>
          )}

          {!isLoading && !isError && (
            <ul>
              {allItems.length === 0 && (
                <li className="px-5 py-10 text-center">
                  <Bell size={28} strokeWidth={1.5} className="text-border mx-auto mb-3" />
                  <p className="text-[15px] font-semibold text-text-primary mb-1">No notifications yet</p>
                  <p className="text-[13px] text-text-secondary leading-relaxed">
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
              <li ref={sentinelRef} />
            </ul>
          )}

          {isFetchingNextPage && (
            <div className="flex justify-center py-3">
              <Loader2 size={14} className="animate-spin text-text-tertiary" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
