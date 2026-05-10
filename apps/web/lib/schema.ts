import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  boolean,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').unique().notNull(),
  username: text('username').unique().notNull(),
  email: text('email').unique().notNull(),
  displayName: text('display_name'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const restaurants = pgTable('restaurants', {
  id: uuid('id').primaryKey().defaultRandom(),
  placeId: text('place_id'),          // nullable — manual entries are first-class (D-06)
  source: text('source'),             // 'google_places' | 'yelp' | 'manual'
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  country: text('country'),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  restaurantsPlaceIdIdx: uniqueIndex('restaurants_place_id_idx')
    .on(table.placeId)
    .where(sql`place_id IS NOT NULL`),
}))

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  restaurantId: uuid('restaurant_id').references(() => restaurants.id),  // nullable for homemade
  mealType: text('meal_type').notNull(),  // 'restaurant' | 'homemade'
  body: text('body'),
  rating: numeric('rating', { precision: 2, scale: 1 }),
  photoUrl: text('photo_url'),
  mealDate: date('meal_date'),
  deletedAt: timestamp('deleted_at'),    // soft-delete (D-06)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  reviewsUserIdx: index('reviews_user_idx').on(table.userId),
}))

export const reviewTags = pgTable('review_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').references(() => reviews.id).notNull(),
  label: text('label').notNull(),
})

export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  followerId: uuid('follower_id').references(() => users.id).notNull(),
  followeeId: uuid('followee_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Indices required for feed and follow graph queries (Pitfall 6 from RESEARCH.md)
  followsFollowerIdx: index('follows_follower_idx').on(table.followerId),
  followsFolloweeIdx: index('follows_followee_idx').on(table.followeeId),
  followsUniqueIdx: uniqueIndex('follows_unique_idx').on(table.followerId, table.followeeId),
}))

export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userAId: uuid('user_a_id').references(() => users.id).notNull(),
  userBId: uuid('user_b_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  friendshipsUniqueIdx: uniqueIndex('friendships_unique_idx').on(table.userAId, table.userBId),
}))

export const feedItems = pgTable('feed_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').references(() => users.id).notNull(),
  reviewId: uuid('review_id').references(() => reviews.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),  // copy of review created_at
}, (table) => ({
  // Index required for fan-out-on-write feed queries
  feedItemsOwnerIdx: index('feed_items_owner_idx').on(table.ownerUserId),
  // Unique constraint enables onConflictDoNothing in fanOutToFollowers (HI-04)
  feedItemsUniqueIdx: uniqueIndex('feed_items_unique_idx').on(table.ownerUserId, table.reviewId),
}))

export const likes = pgTable('likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  reviewId: uuid('review_id').references(() => reviews.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  likesUniqueIdx: uniqueIndex('likes_unique_idx').on(table.userId, table.reviewId),
}))

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(),  // 'follow' | 'like' | 'comment'
  actorId: uuid('actor_id').references(() => users.id),
  reviewId: uuid('review_id').references(() => reviews.id),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const userStats = pgTable('user_stats', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  reviewCount: numeric('review_count').default('0').notNull(),
  avgRating: numeric('avg_rating', { precision: 3, scale: 2 }),
  followerCount: numeric('follower_count').default('0').notNull(),
  followingCount: numeric('following_count').default('0').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
