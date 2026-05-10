import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// ME-02: Explicit guard with descriptive error — avoids opaque "Invalid connection string: undefined"
if (!process.env.DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL')
}

const sql = neon(process.env.DATABASE_URL)
export const db = drizzle(sql, { schema })
