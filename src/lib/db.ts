import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL!

const globalForDb = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: pg.Pool | undefined
}

function getPool() {
  if (!globalForDb.pool) {
    globalForDb.pool = new pg.Pool({
      connectionString,
      // 4 parallel scrapers + API requests + cron enrichment can exhaust a
      // pool of 5 quickly. Raise to 10. Note: when using the Supabase
      // pooler (port 6543 / PgBouncer) the effective server-side limit is
      // higher still, so this is a safe client-side ceiling.
      max: 10,
    })
  }
  return globalForDb.pool
}

function createPrismaClient() {
  const pool = getPool()
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForDb.prisma ?? createPrismaClient()

/** Shared pg pool for raw SQL queries (vector operations, etc.) */
export const pgPool = getPool()

if (process.env.NODE_ENV !== 'production') globalForDb.prisma = prisma
