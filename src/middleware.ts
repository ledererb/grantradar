import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Public API routes that must never require authentication
const PUBLIC_API_ROUTES = ['/api/stripe/webhook', '/api/cron']

// Public page routes
const PUBLIC_PAGES = ['/', '/pricing', '/grants', '/login', '/register', '/privacy', '/terms']

function isPublicApiRoute(pathname: string) {
  return PUBLIC_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

function isPublicPage(pathname: string) {
  return PUBLIC_PAGES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── API routes ─────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Public API routes: do not require auth
    if (isPublicApiRoute(pathname)) {
      return NextResponse.next()
    }

    // Protected API routes: require a session
    // We instantiate a Supabase client with cookie forwarding so getUser() works
    let supabaseResponse = NextResponse.next({ request })
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      return supabaseResponse
    } catch (error) {
      console.warn('[Middleware] Supabase API session error:', error)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ─── Page routes ────────────────────────────────────────────
  const isPublicPath = isPublicPage(pathname)

  // Only run Supabase session middleware on protected page routes
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
  // Run on everything except static assets and the public API routes
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/stripe/webhook|api/cron).*)',
  ],
}
