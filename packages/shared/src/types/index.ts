export interface User {
  id: string
  clerkId: string
  username: string
  email: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Restaurant {
  id: string
  placeId: string | null  // nullable per D-06 — manual entries are first-class
  source: 'google_places' | 'yelp' | 'manual'
  name: string
  address: string | null
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  createdAt: Date
}

export interface Review {
  id: string
  userId: string
  restaurantId: string | null  // nullable for homemade meals
  mealType: 'restaurant' | 'homemade'
  body: string | null
  rating: number | null
  photoUrl: string | null
  mealDate: string | null
  deletedAt: Date | null  // soft-delete per D-06
  createdAt: Date
  updatedAt: Date
}

export interface ReviewTag {
  id: string
  reviewId: string
  label: string
}

export interface Follow {
  id: string
  followerId: string
  followeeId: string
  createdAt: Date
}

export interface Friendship {
  id: string
  userAId: string
  userBId: string
  createdAt: Date
}

export interface FeedItem {
  id: string
  ownerUserId: string
  reviewId: string
  createdAt: Date
}

export interface Like {
  id: string
  userId: string
  reviewId: string
  createdAt: Date
}

export interface Notification {
  id: string
  userId: string
  type: 'follow' | 'like' | 'comment'
  actorId: string | null
  reviewId: string | null
  read: boolean
  createdAt: Date
}

export interface UserStats {
  userId: string
  reviewCount: number
  avgRating: number | null
  followerCount: number
  followingCount: number
  updatedAt: Date
}
