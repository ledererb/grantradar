import { prisma } from '@/lib/db'
import Link from 'next/link'
import { ArrowRight, Calendar, Banknote, Lock } from 'lucide-react'
import {
  formatHuf,
  formatRelativeDate,
  getEffectiveStatus,
  getStatusLabel,
  getStatusColor,
  getFundingTypeLabel,
  getFundingTypeColor,
  isTechnicalGrantCall,
  truncate,
} from '@/lib/utils'
import { PublicNav, PublicFooter } from '@/components/public-nav'
import { classifyGrantProgram } from '@/lib/grant-handbook'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Aktuális pályázatok böngészése — GrantRadar' }

export default async function PublicGrantsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const resolvedParams = await searchParams
  const scope = resolvedParams.scope === 'eu' ? 'eu' : resolvedParams.scope === 'closed' ? 'closed' : 'hu'
  const now = new Date()

  const where =
    scope === 'closed'
      ? {
          OR: [{ status: { in: ['CLOSED' as const, 'ARCHIVED' as const] } }, { deadline: { lt: now } }],
          source: { country: 'HU' as const },
        }
      : {
          status: { in: ['OPEN' as const, 'FORTHCOMING' as const] },
          OR: [{ deadline: null }, { deadline: { gte: now } }],
          source: { country: scope === 'eu' ? ('EU' as const) : ('HU' as const) },
        }

  const [rawGrants, activeOpenHuRows] = await Promise.all([
    prisma.grant.findMany({
      where,
      include: { source: { select: { name: true, country: true } } },
      orderBy: scope === 'closed' ? { deadline: 'desc' } : [{ deadline: 'asc' }, { firstSeenAt: 'desc' }],
      take: 40,
    }),
    prisma.grant.findMany({
      where: {
        status: 'OPEN',
        OR: [{ deadline: null }, { deadline: { gte: now } }],
        source: { country: 'HU' },
      },
      select: { titleHu: true, code: true, status: true, deadline: true, openDate: true },
    }),
  ])

  const grants = rawGrants
    .filter((g) => !isTechnicalGrantCall(g.titleHu, g.code))
    .slice(0, 12)

  const totalOpenHu = activeOpenHuRows.filter(
    (g) => !isTechnicalGrantCall(g.titleHu, g.code) && getEffectiveStatus(g, now) === 'OPEN',
  ).length

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--gr-bg)' }}>
      <PublicNav />

      <div className="pt-28 pb-20 px-6 max-w-5xl mx-auto w-full flex-1">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Aktuális pályázatok</h1>
            <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
              {totalOpenHu} nyitott magyar pályázat — regisztrálj ingyen a teljes adatbázishoz és a cégedre szabott szűréshez
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/grants"
              className={`pill no-underline py-1.5 px-3 ${scope === 'hu' ? 'pill-blue' : 'pill-muted'}`}
            >
              🇭🇺 Nyitott magyar
            </Link>
            <Link
              href="/grants?scope=eu"
              className={`pill no-underline py-1.5 px-3 ${scope === 'eu' ? 'pill-blue' : 'pill-muted'}`}
            >
              🇪🇺 Közvetlen EU
            </Link>
            <Link
              href="/grants?scope=closed"
              className={`pill no-underline py-1.5 px-3 ${scope === 'closed' ? 'pill-amber' : 'pill-muted'}`}
            >
              Lezárult kiírások
            </Link>
          </div>
        </div>

        {grants.length === 0 ? (
          <div className="card p-10 text-center mb-8">
            <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
              Ebben a nézetben jelenleg nincs megjeleníthető pályázat.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-10">
            {grants.map((grant) => {
              const effStatus = getEffectiveStatus(grant, now)
              const profile = classifyGrantProgram({
                code: grant.code,
                program: grant.program,
                titleHu: grant.titleHu,
                fundingType: grant.fundingType,
              })
              return (
                <div key={grant.id} className="card p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {grant.code && (
                      <span
                        className="text-xs mono font-semibold px-2 py-0.5 rounded"
                        style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-text)' }}
                      >
                        {grant.code}
                      </span>
                    )}
                    <span className={`pill ${getStatusColor(effStatus)}`}>
                      {getStatusLabel(effStatus)}
                    </span>
                    <span className={`pill ${getFundingTypeColor(grant.fundingType)}`}>
                      {getFundingTypeLabel(grant.fundingType)}
                    </span>
                    <span className="pill pill-muted">{profile.name.split(' (')[0]}</span>
                  </div>
                  <h3 className="font-semibold mb-1" style={{ color: 'var(--gr-text)' }}>
                    {grant.titleHu || grant.titleEn || 'N/A'}
                  </h3>
                  {(grant.aiSummaryHu || grant.descriptionHu) && (
                    <p className="text-sm mb-2 leading-relaxed" style={{ color: 'var(--gr-text-2)' }}>
                      {truncate(grant.aiSummaryHu || grant.descriptionHu || '', 170)}
                    </p>
                  )}
                  <div
                    className="flex flex-wrap items-center gap-4 text-xs"
                    style={{ color: 'var(--gr-text-3)' }}
                  >
                    {grant.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatRelativeDate(grant.deadline)}
                      </span>
                    )}
                    {grant.maxAmountHuf && (
                      <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--gr-gold)' }}>
                        <Banknote className="w-3 h-3" />
                        {formatHuf(grant.maxAmountHuf)}
                      </span>
                    )}
                    <span>
                      {grant.source.country === 'HU' ? '🇭🇺' : '🇪🇺'} {grant.source.name}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CTA */}
        <div
          className="card p-8 text-center"
          style={{
            borderColor: 'var(--gr-primary)',
            background: 'var(--gr-blue-bg)',
          }}
        >
          <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--gr-primary)' }} />
          <h3 className="text-lg font-bold mb-2">Szeretnéd látni, melyikre jogosult a céged?</h3>
          <p className="text-sm mb-5 max-w-lg mx-auto" style={{ color: 'var(--gr-text-2)' }}>
            Regisztrálj ingyen a teljes hazai és uniós adatbázis eléréséhez, a cégprofil alapú szűréshez és az előkészítő dokumentumlistához.
          </p>
          <Link href="/register" className="btn-primary">
            Ingyenes regisztráció <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
