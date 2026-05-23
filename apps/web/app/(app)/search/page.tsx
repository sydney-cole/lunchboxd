'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserSearchCard } from '@/components/user-search-card'
import { ReviewCard } from '@/components/review-card'
import { Search, Users, UtensilsCrossed, MapPin, Tag } from 'lucide-react'

type FollowState = 'none' | 'following' | 'friends'

interface UserResult {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  followState: FollowState
}

interface ReviewResult {
  id: string
  mealName: string | null
  body: string | null
  rating: string | null
  photoUrl: string | null
  mealType: string
  mealDate: string | null
  createdAt: string
  tags: string[]
  restaurant: { id: string; name: string; address: string | null } | null
  likeCount: number
  isLikedByMe: boolean
  isOwnReview: boolean
  isFriend: boolean
  author: { id: string; username: string; avatarUrl: string | null } | null
}

interface RestaurantResult {
  id: string
  name: string
  address: string | null
  city: string | null
  reviewCount: number
}

interface SearchResults {
  users: UserResult[]
  meals: ReviewResult[]
  restaurants: RestaurantResult[]
  tags: ReviewResult[]
}

type Tab = 'all' | 'people' | 'meals' | 'restaurants' | 'tags'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Search size={14} /> },
  { id: 'people', label: 'People', icon: <Users size={14} /> },
  { id: 'meals', label: 'Meals', icon: <UtensilsCrossed size={14} /> },
  { id: 'restaurants', label: 'Places', icon: <MapPin size={14} /> },
  { id: 'tags', label: 'Tags', icon: <Tag size={14} /> },
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('all')

  const queryClient = useQueryClient()

  useEffect(() => {
    if (query.length < 2) {
      setDebouncedQuery('')
      return
    }
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results, isLoading } = useQuery<SearchResults>({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(debouncedQuery)}`)
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  const likeMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const res = await fetch('/api/v1/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      })
      if (!res.ok) throw new Error('Like failed')
      return res.json()
    },
    onMutate: async (reviewId) => {
      await queryClient.cancelQueries({ queryKey: ['search', debouncedQuery] })
      const prev = queryClient.getQueryData<SearchResults>(['search', debouncedQuery])
      queryClient.setQueryData<SearchResults>(['search', debouncedQuery], (old) => {
        if (!old) return old
        function toggleLike(list: ReviewResult[]) {
          return list.map(r =>
            r.id === reviewId
              ? { ...r, isLikedByMe: !r.isLikedByMe, likeCount: r.isLikedByMe ? r.likeCount - 1 : r.likeCount + 1 }
              : r
          )
        }
        return { ...old, meals: toggleLike(old.meals), tags: toggleLike(old.tags) }
      })
      return { prev }
    },
    onError: (_err, _reviewId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['search', debouncedQuery], ctx.prev)
    },
  })

  function handleLike(reviewId: string) {
    likeMutation.mutate(reviewId)
  }

  function noop() {}

  const hasResults = results && (
    results.users.length > 0 ||
    results.meals.length > 0 ||
    results.restaurants.length > 0 ||
    results.tags.length > 0
  )

  const tabCount = {
    all: (results?.users.length ?? 0) + (results?.meals.length ?? 0) + (results?.restaurants.length ?? 0) + (results?.tags.length ?? 0),
    people: results?.users.length ?? 0,
    meals: results?.meals.length ?? 0,
    restaurants: results?.restaurants.length ?? 0,
    tags: results?.tags.length ?? 0,
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-bg">
    <div className="w-full max-w-[640px] mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Search</h1>
        <p className="text-sm text-text-secondary">Find people, meals, restaurants, and tags</p>
      </div>

      {/* Search input */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for chicken, sushi, @username..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          autoFocus
        />
      </div>

      {/* Tabs — only show when there's a query */}
      {debouncedQuery.length >= 2 && (
        <div className="flex gap-1 mb-5 overflow-x-auto border-b border-border pb-0" style={{ scrollbarWidth: 'none' }}>
          {TABS.map((tab) => {
            const count = tabCount[tab.id]
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors duration-150 focus:outline-none ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.icon}
                {tab.label}
                {!isLoading && count > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-accent text-white' : 'bg-surface-subtle text-text-tertiary'
                  }`}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* States */}
      {query.length === 1 && (
        <p className="text-sm text-text-secondary text-center py-8">Keep typing to search…</p>
      )}

      {isLoading && debouncedQuery.length >= 2 && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-surface-subtle animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && debouncedQuery.length >= 2 && !hasResults && (
        <div className="text-center py-12">
          <p className="text-text-secondary text-sm">No results for <span className="font-medium text-text-primary">&ldquo;{debouncedQuery}&rdquo;</span></p>
          <p className="text-text-tertiary text-xs mt-1">Try a different search term</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && results && hasResults && (
        <div className="space-y-6">

          {/* ALL TAB */}
          {activeTab === 'all' && (
            <>
              {results.users.length > 0 && (
                <Section
                  title="People"
                  count={results.users.length}
                  onViewAll={() => setActiveTab('people')}
                  showViewAll={results.users.length > 3}
                >
                  <div className="space-y-2">
                    {results.users.slice(0, 3).map(user => (
                      <UserSearchCard key={user.id} user={user} />
                    ))}
                  </div>
                </Section>
              )}

              {results.meals.length > 0 && (
                <Section
                  title="Meals"
                  count={results.meals.length}
                  onViewAll={() => setActiveTab('meals')}
                  showViewAll={results.meals.length > 3}
                >
                  <div className="space-y-3">
                    {results.meals.slice(0, 3).map(review => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        onEdit={noop}
                        onDelete={noop}
                        onLike={handleLike}
                        showAuthor
                        isOwnReview={false}
                      />
                    ))}
                  </div>
                </Section>
              )}

              {results.restaurants.length > 0 && (
                <Section
                  title="Places"
                  count={results.restaurants.length}
                  onViewAll={() => setActiveTab('restaurants')}
                  showViewAll={results.restaurants.length > 3}
                >
                  <div className="space-y-2">
                    {results.restaurants.slice(0, 3).map(r => (
                      <RestaurantCard key={r.id} restaurant={r} />
                    ))}
                  </div>
                </Section>
              )}

              {results.tags.length > 0 && (
                <Section
                  title="Tagged meals"
                  count={results.tags.length}
                  onViewAll={() => setActiveTab('tags')}
                  showViewAll={results.tags.length > 3}
                >
                  <div className="space-y-3">
                    {results.tags.slice(0, 3).map(review => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        onEdit={noop}
                        onDelete={noop}
                        onLike={handleLike}
                        showAuthor
                        isOwnReview={false}
                      />
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {/* PEOPLE TAB */}
          {activeTab === 'people' && (
            results.users.length > 0 ? (
              <div className="space-y-2">
                {results.users.map(user => (
                  <UserSearchCard key={user.id} user={user} />
                ))}
              </div>
            ) : (
              <EmptyTab label="No people found" />
            )
          )}

          {/* MEALS TAB */}
          {activeTab === 'meals' && (
            results.meals.length > 0 ? (
              <>
                <FriendsBadge meals={results.meals} />
                <div className="space-y-3">
                  {results.meals.map(review => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      onEdit={noop}
                      onDelete={noop}
                      onLike={handleLike}
                      showAuthor
                      isOwnReview={false}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyTab label="No meals found" />
            )
          )}

          {/* RESTAURANTS TAB */}
          {activeTab === 'restaurants' && (
            results.restaurants.length > 0 ? (
              <div className="space-y-2">
                {results.restaurants.map(r => (
                  <RestaurantCard key={r.id} restaurant={r} />
                ))}
              </div>
            ) : (
              <EmptyTab label="No places found" />
            )
          )}

          {/* TAGS TAB */}
          {activeTab === 'tags' && (
            results.tags.length > 0 ? (
              <>
                <p className="text-xs text-text-tertiary">
                  Reviews tagged with &ldquo;<span className="font-medium text-text-secondary">{debouncedQuery}</span>&rdquo;
                </p>
                <FriendsBadge meals={results.tags} />
                <div className="space-y-3">
                  {results.tags.map(review => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      onEdit={noop}
                      onDelete={noop}
                      onLike={handleLike}
                      showAuthor
                      isOwnReview={false}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyTab label={`No reviews tagged with "${debouncedQuery}"`} />
            )
          )}

        </div>
      )}
    </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  count,
  onViewAll,
  showViewAll,
  children,
}: {
  title: string
  count: number
  onViewAll: () => void
  showViewAll: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wide">
          {title}
          <span className="ml-1.5 text-text-tertiary font-normal normal-case tracking-normal">({count})</span>
        </h2>
        {showViewAll && (
          <button
            onClick={onViewAll}
            className="text-[12px] font-medium text-accent hover:text-accent-hover transition-colors"
          >
            View all
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function RestaurantCard({ restaurant }: { restaurant: RestaurantResult }) {
  const isReviewed = restaurant.reviewCount > 0
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface hover:border-accent/50 transition-colors">
      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
        <MapPin size={15} className="text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        {isReviewed ? (
          <a
            href={`/restaurants/${restaurant.id}`}
            className="text-sm font-medium text-text-primary hover:text-accent hover:underline transition-colors"
          >
            {restaurant.name}
          </a>
        ) : (
          <p className="text-sm font-medium text-text-primary truncate">{restaurant.name}</p>
        )}
        {(restaurant.address || restaurant.city) && (
          <p className="text-xs text-text-secondary truncate">
            {[restaurant.address, restaurant.city].filter(Boolean).join(', ')}
          </p>
        )}
        <div className="mt-1">
          {isReviewed ? (
            <a
              href={`/restaurants/${restaurant.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition-colors"
            >
              ✓ {restaurant.reviewCount} {restaurant.reviewCount === 1 ? 'review' : 'reviews'}
            </a>
          ) : (
            <a
              href={`/reviews/new?restaurantId=${encodeURIComponent(restaurant.id)}&restaurantName=${encodeURIComponent(restaurant.name)}`}
              className="text-[11px] font-medium text-accent hover:underline"
            >
              + Add a review
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function FriendsBadge({ meals }: { meals: ReviewResult[] }) {
  const friendCount = meals.filter(m => m.isFriend).length
  if (friendCount === 0) return null
  return (
    <p className="text-xs text-text-tertiary -mt-2 mb-1">
      <span className="text-accent font-medium">{friendCount} from people you follow</span>
      {' '}· sorted by friends first, then most liked
    </p>
  )
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="text-center py-10">
      <p className="text-text-secondary text-sm">{label}</p>
    </div>
  )
}
