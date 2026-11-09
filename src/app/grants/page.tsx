import { prisma } from '@/lib/db'
import Link from 'next/link'
import { ArrowRight, Calendar, Euro, Lock } from 'lucide-react'
import {
  formatHuf,
  formatRelativeDate,
  getStatusLabel,
  getStatusColor,
  getFundingTypeLabel,
  getFundingTypeColor,
  truncate,
} from '@/lib/utils'
import { PublicNav, PublicFooter } from '@/components/public-nav'
import { classifyGrantProgram } from '@/lib/grant-handbook'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Pályázatok böngészése' }

export default async function PublicGrantsPage() {
  const grants = await prisma.grant.findMany({
    where: { status: { in: ['OPEN', 'FORTHCOMING'] } },
    include: { source: { select: { name: true, country: true } } },
    orderBy: { deadline: 'asc' },
    take: 10,
  })

  const totalOpen = await prisma.grant.count({ where: { status: 'OPEN' } })

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--gr-bg)' }}>
      <PublicNav />

      <div className="pt-28 pb-20 px-6 max-w-5xl mx-auto w-full flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Aktuális pályázatok</h1>
          <p className="text-sm" style={{ color: 'var(--gr-text-2)' }}>
            {totalOpen} nyitott pályázat — regisztrálj az összes megtekintéséhez, szűréshez és AI-elemzésekhez
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {grants.map((grant) => {
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
                      className="text-xs mono px-2 py-0.5 rounded"
                      style={{ background: 'var(--gr-bg-surface)', color: 'var(--gr-gold)' }}
                    >
                      {grant.code}
                    </span>
                  )}
                  <span className={`pill ${getStatusColor(grant.status)}`}>
                    {getStatusLabel(grant.status)}
                  </span>
                  <span className={`pill ${getFundingTypeColor(grant.fundingType)}`}>
                    {getFundingTypeLabel(grant.fundingType)}
                  </span>
                  <span className="pill pill-muted">{profile.name}</span>
                </div>
                <h3 className="font-semibold mb-1">{grant.titleHu || grant.titleEn || 'N/A'}</h3>
                {(grant.aiSummaryHu || grant.descriptionHu) && (
                  <p className="text-sm mb-2" style={{ color: 'var(--gr-text-2)' }}>
                    {truncate(grant.aiSummaryHu || grant.descriptionHu || '', 160)}
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
                    <span className="flex items-center gap-1">
                      <Euro className="w-3 h-3" />
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

        {/* CTA */}
        <div
          className="card p-8 text-center"
          style={{
            borderColor: 'var(--gr-gold-border)',
            background: 'var(--gr-gold-dim)',
          }}
        >
          <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--gr-gold)' }} />
          <h3 className="text-lg font-bold mb-2">Többet szeretnél látni?</h3>
          <p className="text-sm mb-5" style={{ color: 'var(--gr-text-2)' }}>
            Regisztrálj ingyen a teljes adatbázisért, jogosultsági mátrixért, 10 pontos előkészítési checklistért és e-mail riasztásokért.
          </p>
          <Link href="/register" className="btn-gold">
            Regisztrálok ingyen <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
