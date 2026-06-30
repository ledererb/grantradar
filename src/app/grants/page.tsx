import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Radar, ArrowRight, Calendar, Euro, Lock, Search } from 'lucide-react'
import { formatHuf, formatRelativeDate, getStatusLabel, getStatusColor, getFundingTypeLabel, getFundingTypeColor, truncate } from '@/lib/utils'
import { PublicNav, PublicFooter } from '@/components/public-nav'

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
    <div className="min-h-screen" style={{ background: 'var(--gr-bg-base)' }}>
      <PublicNav />

      <div className="pt-28 pb-20 px-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Aktuális pályázatok</h1>
          <p className="text-sm" style={{ color: 'var(--gr-text-secondary)' }}>
            {totalOpen} nyitott pályázat — regisztrálj az összes megtekintéséhez, szűréshez és AI-elemzésekhez
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {grants.map((grant) => (
            <div key={grant.id} className="glass-card p-5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {grant.code && <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--gr-bg-elevated)', color: 'var(--gr-primary-light)' }}>{grant.code}</span>}
                <span className={`badge ${getStatusColor(grant.status)}`}>{getStatusLabel(grant.status)}</span>
                <span className={`badge ${getFundingTypeColor(grant.fundingType)}`}>{getFundingTypeLabel(grant.fundingType)}</span>
              </div>
              <h3 className="font-semibold mb-1">{grant.titleHu || grant.titleEn || 'N/A'}</h3>
              {grant.aiSummaryHu && <p className="text-sm mb-2" style={{ color: 'var(--gr-text-secondary)' }}>{truncate(grant.aiSummaryHu, 150)}</p>}
              <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--gr-text-muted)' }}>
                {grant.deadline && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatRelativeDate(grant.deadline)}</span>}
                {grant.maxAmountHuf && <span className="flex items-center gap-1"><Euro className="w-3 h-3" />{formatHuf(grant.maxAmountHuf)}</span>}
                <span>{grant.source.country === 'HU' ? '🇭🇺' : '🇪🇺'} {grant.source.name}</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="glass-card p-8 text-center" style={{ borderColor: 'var(--gr-primary)', boxShadow: '0 0 40px rgba(99, 102, 241, 0.1)' }}>
          <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--gr-primary-light)' }} />
          <h3 className="text-lg font-bold mb-2">Többet szeretnél látni?</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--gr-text-secondary)' }}>
            Regisztrálj ingyen az AI-elemzésekért, szűrésért, szemantikus keresésért és e-mail értesítésekért.
          </p>
          <Link href="/register" className="btn-primary">Regisztrálok ingyen<ArrowRight className="w-4 h-4" /></Link>
        </div>
      </div>
    </div>
  )
}
