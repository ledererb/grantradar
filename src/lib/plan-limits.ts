import { prisma } from '@/lib/db'

/**
 * Feature/usage limits per plan.
 *
 * NOTE: the `plan` value lives on the Subscription model (see prisma/schema.prisma),
 * not on User. A user with no Subscription row is treated as FREE.
 */
export const PLAN_LIMITS = {
  FREE: { maxSavedGrants: 5, semanticSearch: false, alerts: false },
  PRO: { maxSavedGrants: Infinity, semanticSearch: true, alerts: true },
  AGENCY: { maxSavedGrants: Infinity, semanticSearch: true, alerts: true },
} as const

export type Plan = keyof typeof PLAN_LIMITS

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

/**
 * Resolve the effective plan for a user.
 *
 * Reads the Subscription row (1:1 to User). If no subscription exists, or the
 * subscription is not in an active status, the user is treated as FREE.
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  })

  if (!subscription) return 'FREE'
  if (!ACTIVE_STATUSES.has(subscription.status)) return 'FREE'
  // If the period already ended without renewal, downgrade to FREE.
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() < Date.now()) {
    return 'FREE'
  }

  return (subscription.plan in PLAN_LIMITS ? subscription.plan : 'FREE') as Plan
}

export function planLimits(plan: Plan) {
  return PLAN_LIMITS[plan]
}

/**
 * Resolve the dbUser + effective plan for the current Supabase auth user.
 * Returns `{ dbUser: null, plan: 'FREE' }` if not authenticated or not in our DB.
 */
export async function getCurrentUserPlan(): Promise<{ dbUser: { id: string } | null; plan: Plan }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { dbUser: null, plan: 'FREE' }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true },
  })
  if (!dbUser) return { dbUser: null, plan: 'FREE' }

  const plan = await getUserPlan(dbUser.id)
  return { dbUser, plan }
}
