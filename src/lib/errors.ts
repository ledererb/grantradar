import { NextResponse } from 'next/server'

/**
 * Centralized API error handler.
 *
 * Logs the full error server-side (with a context tag) but returns a generic,
 * sanitized message to the client so that internal details (Stripe customer /
 * request IDs, Prisma internals, stack traces) never leak.
 */
export function handleApiError(error: unknown, context: string): NextResponse {
  console.error(`[${context}]`, error)

  // Stripe errors carry a `type` that starts with "Stripe" (e.g.
  // "StripeCardError", "StripeInvalidRequestError"). Surface a safe,
  // payment-specific message instead of the raw Stripe detail.
  if (error instanceof Error) {
    const type = (error as { type?: unknown }).type
    if (typeof type === 'string' && type.startsWith('Stripe')) {
      return NextResponse.json(
        { error: 'Payment processing error. Please try again.' },
        { status: 402 },
      )
    }

    // Prisma client errors expose a `code` like P2002. Treat them as bad
    // requests where possible, otherwise fall through to a generic 500.
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && code.startsWith('P') && /^P\d{3,4}$/.test(code)) {
      return NextResponse.json(
        { error: 'Request could not be processed.' },
        { status: 400 },
      )
    }
  }

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 },
  )
}
