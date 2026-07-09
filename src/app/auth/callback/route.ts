import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const safeNext = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Ensure a User row exists in the Prisma DB for this Supabase user
      const supabaseUser = data.user
      if (supabaseUser?.id && supabaseUser?.email) {
        try {
          await prisma.user.upsert({
            where: { supabaseId: supabaseUser.id },
            create: {
              supabaseId: supabaseUser.id,
              email: supabaseUser.email,
            },
            update: { email: supabaseUser.email },
          })
        } catch (err) {
          console.error('[Auth Callback] Failed to upsert user:', err)
        }
      }

      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
