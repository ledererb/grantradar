import { Ratelimit } from '@upstash/ratelimit'
import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

export const searchRateLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(3, '1 m'),
  analytics: true,
})

export const generalRateLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  analytics: true,
})

type RateLimiter = typeof searchRateLimit

/**
 * Apply rate limiting to a request using the client IP.
 * Returns null when allowed, or a 429 NextResponse when the limit is exceeded.
 */
export async function applyRateLimit(
  limiter: RateLimiter,
  request: Request,
): Promise<NextResponse | null> {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? 'anonymous'

  let result
  try {
    result = await limiter.limit(ip)
  } catch (error) {
    // KV/Redis not configured (e.g. local dev) — fail open so requests proceed.
    console.warn('[rate-limit] limiter unavailable, allowing request', error)
    return null
  }

  const { success, limit, remaining, reset } = result

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      },
    )
  }

  return null
}
