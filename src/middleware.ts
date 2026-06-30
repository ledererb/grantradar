import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Skip Supabase session management for public routes
  const publicPaths = ['/', '/pricing', '/grants', '/login', '/register', '/privacy', '/terms']
  const isPublicPath = publicPaths.some(path =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith('/api/')
  )

  // Only run Supabase session middleware on protected routes
  if (!isPublicPath) {
    try {
      return await updateSession(request)
    } catch (error) {
      // If Supabase is not configured yet, let the request through
      console.warn('[Middleware] Supabase session error:', error)
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/cron|api/stripe/webhook).*)',
  ],
}
