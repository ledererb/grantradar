import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, Calendar, Bookmark, Lock, CheckSquare } from 'lucide-react'
import { formatRelativeDate, getStatusLabel } from '@/lib/utils'
import { getUserPlan, planLimits, type Plan } from '@/lib/plan-limits'
import {
  parseSavedGrantState,
  classifyGrantProgram,
  PREPARATION_CHECKLIST_ITEMS,
} from '@/lib/grant-handbook'

export const dynamic = 'force-dynamic'

export default async function SavedGrantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--gr-text-3)' }}>Kérlek, jelentkezz be.</p>
      </div>
    )
  }

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } })

  const savedGrants = dbUser
    ? await prisma.savedGrant.findMany({
        where: { userId: dbUser.id },
        include: {
          grant: {
            include: { source: { select: { name: true, country: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const plan: Plan = dbUser ? await getUserPlan(dbUser.id) : 'FREE'
  const limits = planLimits(plan)
  const isCapped = limits.maxSavedGrants !== Infinity
  const atLimit = isCapped && savedGrants.length >= limits.maxSavedGrants

  const countLabel = isCapped
    ? `${savedGrants.length}/${limits.maxSavedGrants} pályázat mentve`
    : `${savedGrants.length} pályázat mentve`

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          Mentett pályázatok & Előkészítés
        </h1>
        <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
          {countLabel} · Kattints egy pályázatra a dokumentum-checklist és a jogosultsági mátrix megnyitásához
        </p>
      </div>

      {isCapped && plan !== 'PRO' && plan !== 'AGENCY' && (
        <div
          className="card p-4 mb-6 flex items-center gap-3"
          style={{ borderColor: 'var(--gr-gold)' }}
        >
          <Lock className="w-4 h-4 shrink-0" style={{ color: 'var(--gr-gold)' }} />
          <div className="flex-1 text-sm">
            {atLimit
              ? 'Elérted a FREE csomag mentési limitjét.'
              : `A FREE csomaggal ${limits.maxSavedGrants} pályázat menthető.`}{' '}
            <Link href="/dashboard/billing" className="underline" style={{ color: 'var(--gr-gold)' }}>
              Válts PRO-ra korlátlan mentésért
            </Link>
          </div>
        </div>
      )}

      {savedGrants.length === 0 ? (
        <div className="card p-12 text-center">
          <Bookmark className="w-8 h-8 mx-auto mb-4" style={{ color: 'var(--gr-text-3)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--gr-text-3)' }}>
            Még nincsenek mentett pályázataid.
          </p>
          <Link href="/dashboard/grants" className="btn-primary text-sm py-2 px-6 inline-flex">
            Pályázatok böngészése
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {savedGrants.map(({ grant, notes }) => {
            const state = parseSavedGrantState(notes)
            const progProfile = classifyGrantProgram(grant)
            const totalDocs = PREPARATION_CHECKLIST_ITEMS.filter(
              (item) => !item.kapOnly || progProfile.family === 'KAP',
            ).length
            const doneDocs = state.checkedDocs.length

            return (
              <Link
                key={grant.id}
                href={`/dashboard/grants/${grant.id}`}
                className="card card-interactive p-4 block no-underline group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {grant.code && (
                        <span
                          className="mono text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-gold)' }}
                        >
                          {grant.code}
                        </span>
                      )}
                      <span className={`pill ${grant.status === 'OPEN' ? 'pill-green' : 'pill-amber'}`}>
                        {getStatusLabel(grant.status)}
                      </span>
                      <span className="pill pill-muted">
                        <CheckSquare className="w-3 h-3" />
                        Előkészítés: {doneDocs}/{totalDocs} irat
                      </span>
                      <Bookmark
                        className="w-3 h-3"
                        style={{ color: 'var(--gr-gold)', fill: 'var(--gr-gold)' }}
                      />
                    </div>
                    <h3 className="text-sm font-semibold mb-1 truncate">
                      {grant.titleHu || grant.titleEn || 'N/A'}
                    </h3>
                    {state.notes && (
                      <p className="text-xs mb-1.5 truncate" style={{ color: 'var(--gr-text-2)' }}>
                        Jegyzet: {state.notes}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--gr-text-3)' }}>
                      {grant.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatRelativeDate(grant.deadline)}
                        </span>
                      )}
                      <span>
                        {grant.source.country === 'HU' ? '🇭🇺' : '🇪🇺'} {grant.source.name}
                      </span>
                    </div>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 mt-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--gr-gold)' }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
